import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

// Ejecutar tras next build. Usa Chromium instalado en el runner, sin dependencias
// nuevas, sesión real ni datos privados. Verifica el PDF, no solo el CSS.
const executable = process.env.CHROME_BIN || ['google-chrome', 'chromium', 'chromium-browser'].find(name => spawnSync('which', [name]).status === 0)
assert.ok(executable, 'Chromium/Chrome requerido para comprobar impresión')
const cssDir = '.next/static/chunks'
assert.ok(existsSync(cssDir), 'Ejecutar npm run build antes de esta prueba')
const files = readdirSync(cssDir, { recursive: true }).filter(path => path.endsWith('.css'))
assert.ok(files.length, 'No se encontró CSS compilado')
const css = files.map(path => readFileSync(join(cssDir, path), 'utf8')).join('\n')
assert.match(css, /@page\s*\{[^}]*size:\s*297mm\s+167mm[^}]*margin:\s*0(?:px)?[;}]/, 'Regla raíz panorámica no compilada')
const { DashboardPrintReport } = loadModule('components/dashboard/QuejasSummary.tsx')

const counts = [75, 12, 9, 8, 32, 17, 2]
const states = ['Recibido', 'En Investigación', 'Pendiente de Revisión GC', 'Resuelto', 'Finalizado', 'No Procede', 'Otros']
const data = {
  received: counts.reduce((sum, n) => sum + n, 0),
  active: counts.slice(0, 4).reduce((sum, n) => sum + n, 0),
  resolution: { good: 18, total: 20 }, observed: 23, average: 13.5, durationTotal: 23,
  procedure: { good: 61, total: 67 }, evaluation: { good: 22, total: 26 }, investigation: { good: 18, total: 20 },
  distribution: states.map((state, i) => ({ state, count: counts[i] })),
  monthly: Array.from({ length: 12 }, (_, i) => ({ month: '2026-' + String(i + 1).padStart(2, '0'), received: 8 + i * 3, resolvedOnTime: i % 3 ? i + 1 : 0, resolvedEvaluable: i + 3 })),
  areas: ['Evaluación de organismos de certificación y verificación', 'Acreditación de laboratorios de ensayo y calibración', 'Gestión administrativa y atención de usuarios', 'Servicios de inspección y seguimiento técnico', 'Gestión de calidad y mejora continua'].map((area, i) => ({ area, count: 28 - i * 4 })),
}
const report = renderToStaticMarkup(createElement(DashboardPrintReport, { data, period: '2026', generated: '24 de noviembre de 2026, 5:00 p. m.' }))
const temp = mkdtempSync(join(tmpdir(), 'qms-print-'))
const filename = join(temp, 'report.html')
writeFileSync(filename, '<!doctype html><html lang="es"><head><meta charset="utf-8"><style>' + css + '</style></head><body class="select-none"><div class="flex h-dvh overflow-hidden bg-qms-background"><aside class="w-64">SIDEBAR OCULTO</aside><div class="flex min-w-0 flex-1 flex-col"><header>HEADER OCULTO</header><main id="app-content" class="relative min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"><div data-dashboard-print><div data-dashboard-screen class="print:hidden">PANTALLA OCULTA</div>' + report + '</div></main></div></div></body></html>')
const chrome = spawn(executable, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + join(temp, 'profile'), 'about:blank'], { stdio: 'ignore' })
let socket
try {
  const portFile = join(temp, 'profile', 'DevToolsActivePort')
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.ok(existsSync(portFile), 'Chrome no inició')
  const port = readFileSync(portFile, 'utf8').split('\n')[0]
  const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
  const tab = pages.find(page => page.type === 'page')
  assert.ok(tab)
  socket = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let seq = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data)
    if (!msg.id || !pending.has(msg.id)) return
    const { resolve, reject, timer } = pending.get(msg.id)
    clearTimeout(timer); pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result)
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Tiempo agotado: ' + method)) }, 15_000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
  await call('Page.enable')
  await call('Page.navigate', { url: pathToFileURL(filename).href })
  let loaded = false
  for (let i = 0; i < 100 && !loaded; i++) {
    const result = await call('Runtime.evaluate', { expression: "document.readyState === 'complete' && !!document.querySelector('[data-dashboard-report]')", returnByValue: true })
    loaded = result.result.value === true
    if (!loaded) await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(loaded, 'No se cargó la reproducción')
  await call('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
  for (const [label, paperWidth, paperHeight] of [['A4', 210 / 25.4, 297 / 25.4], ['Carta', 8.5, 11]]) {
    const pdf = await call('Page.printToPDF', { landscape: true, paperWidth, paperHeight, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true, headerTemplate: '<span>CHROME_HEADER_SENTINEL</span>', footerTemplate: '<span>CHROME_FOOTER_SENTINEL</span>' })
    const bytes = Buffer.from(pdf.data, 'base64')
    const out = join(temp, label + '.pdf')
    writeFileSync(out, bytes)
    const numberOfPages = (bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length
    assert.equal(numberOfPages, 2, label + ': se esperaban exactamente dos páginas')
    const mediaBoxes = [...bytes.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)]
    assert.ok(mediaBoxes.length, 'PDF sin MediaBox')
    for (const [, width, height] of mediaBoxes) {
      assert.ok(Math.abs(Number(width) - 297 / 25.4 * 72) < 2, label + ': ancho no panorámico ' + width)
      assert.ok(Math.abs(Number(height) - 167 / 25.4 * 72) < 2, label + ': alto no panorámico ' + height)
    }
    const extract = page => spawnSync('pdftotext', ['-f', String(page), '-l', String(page), '-layout', out, '-'], { encoding: 'utf8' })
    if (spawnSync('which', ['pdftotext']).status === 0) {
      const first = extract(1), second = extract(2)
      assert.equal(first.status, 0); assert.equal(second.status, 0)
      assert.doesNotMatch(first.stdout + second.stdout, /CHROME_(HEADER|FOOTER)_SENTINEL/)
      assert.match(first.stdout, /Reporte de Indicadores del SGC/)
      assert.match(first.stdout, /Tendencia mensual/)
      assert.match(first.stdout, /Página\s+1\s+de\s+2/)
      assert.doesNotMatch(first.stdout, /Distribución por estado|Top áreas afectadas|SIDEBAR OCULTO|PANTALLA OCULTA/)
      assert.match(second.stdout, /Distribución por estado/)
      assert.match(second.stdout, /Top áreas afectadas/)
      assert.match(second.stdout, /Cumplimiento por etapa/)
      assert.match(second.stdout, /Página\s+2\s+de\s+2/)
      assert.doesNotMatch(second.stdout, /Tendencia mensual/)
      // El orden de pintura (raw) evita intercalar cantidades de la otra columna.
      const raw = spawnSync('pdftotext', ['-f', '2', '-l', '2', '-raw', out, '-'], { encoding: 'utf8' })
      assert.equal(raw.status, 0)
      for (const { area } of data.areas) assert.ok(raw.stdout.replace(/\s+/g, ' ').includes(area), label + ': área faltante ' + area)
    }
    console.log(label + ': 2 láminas panorámicas 297 × 167 mm, sin encabezados del navegador')
  }
} finally {
  socket?.close()
  chrome.kill()
  await new Promise(resolve => { if (chrome.exitCode !== null || chrome.signalCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 2000).unref() } })
  // Chromium puede mantener procesos hijos escribiendo durante el cierre.
  rmSync(temp, { recursive: true, force: true, maxRetries: 12, retryDelay: 200 })
}
