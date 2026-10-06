import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { gzipSync } from 'node:zlib'

// Medir los archivos que Next incluye al entrar en cada ruta, sin contar dos veces
// los chunks compartidos. gzip es una estimación de transferencia, no una métrica
// de tiempo de carga, scroll, caché del navegador ni latencia de Supabase.
const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const buildDir = path.resolve(option('--build-dir', '.next'))
const output = option('--output', null)
const label = option('--label', 'current')
const routes = ['/', '/login', '/quejas', '/mis-quejas', '/configuracion', '/documentos', '/sacp', '/usuarios']
const sumFiles = (files) => {
  // Fallar si falta un chunk: omitirlo produciría una mejora ficticia del bundle.
  const unique = [...new Set(files)]
  return unique.reduce((sum, file) => {
    const buffer = fs.readFileSync(path.join(buildDir, file))
    return { files: sum.files + 1, bytes: sum.bytes + buffer.length, gzipBytes: sum.gzipBytes + gzipSync(buffer).length }
  }, { files: 0, bytes: 0, gzipBytes: 0 })
}

const results = routes.map(route => {
  const relative = route === '/' ? '' : route.slice(1) + '/'
  const filename = path.join(buildDir, 'server/app', relative + 'page_client-reference-manifest.js')
  // Es un manifiesto local generado por Next, ejecutado en un contexto aislado sin require/process.
  const context = {}
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { timeout: 1000 })
  const manifest = Object.values(context.__RSC_MANIFEST)[0]
  const build = JSON.parse(fs.readFileSync(path.join(buildDir, 'server/app', relative + 'page/build-manifest.json'), 'utf8'))
  const js = [...build.rootMainFiles, ...Object.values(manifest.entryJSFiles).flat()]
  const css = Object.values(manifest.entryCSSFiles).flat().map(entry => entry.path)
  const dynamic = JSON.parse(fs.readFileSync(path.join(buildDir, 'server/app', relative + 'page/react-loadable-manifest.json'), 'utf8'))
  const deferred = Object.values(dynamic).flatMap(entry => entry.files).filter(file => !js.includes(file))
  return { route, initialJs: sumFiles(js), initialCss: sumFiles(css), deferredJs: sumFiles(deferred) }
})
const report = { label, generatedAt: new Date().toISOString(), metric: 'unique production entry files; gzip estimated per file; excludes deferred JS from initial JS', routes: results }
if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
}
console.table(results.map(row => ({
  route: row.route,
  'JS gzip KiB': (row.initialJs.gzipBytes / 1024).toFixed(1),
  'CSS gzip KiB': (row.initialCss.gzipBytes / 1024).toFixed(1),
  'deferred JS gzip KiB': (row.deferredJs.gzipBytes / 1024).toFixed(1),
})))
