// Development-only visual fixture server. Never imported by app/ or deployed.
// All backend/auth imports are replaced at bundle time with synthetic data.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import ts from 'typescript'

const root = process.cwd()
const names = new Map()
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { if (entry.name !== 'api') scan(file); continue }
    if (!/\.tsx?$/.test(file)) continue
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node)) continue
      const spec = node.moduleSpecifier.text
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        const set = names.get(spec) || new Set()
        for (const item of bindings.elements) set.add(item.propertyName?.text || item.name.text)
        names.set(spec, set)
      }
    }
  }
}
scan('app'); scan('components'); scan('hooks')
const complaint = { id: 'visual-1', folio: 'QUEJA-2026-0045', cliente_nombre: 'Ejemplo de cliente', email_cliente: 'ejemplo@example.com', categoria: 'Queja', descripcion: 'Registro de ejemplo para comprobar la presentación de la interfaz.', prioridad: 'Media', estado: 'En Investigación', fecha: '2026-09-08T12:00:00Z', responsable_id: 'visual-user', notas: '[Procede] Se solicita investigar el caso.', fecha_sla: '2026-09-15T12:00:00Z' }
const queryData = {
  useDashboard: { indicadores: ['Quejas abiertas','Acciones pendientes','Documentos en edición','Riesgos activos'].map((label, i) => ({ label, valor: [12, 8, 24, 5][i], url: ['/quejas','/sacp','/documentos','/riesgos'][i] })), tareas: [{ id:'1', titulo:'QUEJA-2026-0045', tipo:'Queja', estado:'En Proceso', vence:'2026-09-15' }] },
  useActividadReciente: [{ id:'1', descripcion:'Se asignó una queja para investigación.', created_at:'2026-09-10T12:00:00Z' }],
  useQuejas: {data:[complaint], count:1},
  useQuejasEstadisticas: {pctATiempo:92,pctProcedencia:85,resueltasTotal:24,totalConDecision:30,procedentes:26,mesActual:7},
  useDocumentos: { data: [{id:'1',codigo_doc:'DOC-001',titulo:'Procedimiento de gestión de calidad',version_actual:'1.0',estado:'Borrador',created_at:'2026-09-01'}], count:1 },
}
const mockPattern = /^@\/(?:lib\/(?:queries\/|services\/|store\/auth-store|supabase)|hooks\/(?:useRealtimeSubscription|useHoverPrefetch))/
const result = await build({
  entryPoints: ['scripts/visual-check/entry.jsx'], bundle:true, write:false,
  format:'esm', platform:'browser', jsx:'automatic',
  define:{ 'process.env.NODE_ENV':'"development"' },
  plugins:[{ name:'visual-fixtures', setup(b) {
    b.onResolve({filter:/^next\/(link|navigation)$/}, args=>({path:args.path,namespace:'fixture'}))
    b.onResolve({filter:mockPattern},args=>({path:args.path,namespace:'fixture'}))
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>{
      let contents = ''
      if(args.path==='next/navigation') contents = `import {useSyncExternalStore} from 'react'; export const usePathname=()=>useSyncExternalStore(cb=>{window.addEventListener('popstate',cb);return ()=>window.removeEventListener('popstate',cb)},()=>location.pathname); export const useRouter=()=>({push:go,replace:go}); function go(url){history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'))} export const useSearchParams=()=>new URLSearchParams(location.search);`
      else if(args.path==='next/link') contents = `import React from 'react'; export default function Link({href,children,prefetch,...props}){return React.createElement('a',{...props,href,onClick:e=>{e.preventDefault();history.pushState({},'',href);window.dispatchEvent(new PopStateEvent('popstate'))}},children)}`
      else if(args.path.includes('auth-store')) contents = `const state={user:{id:'visual-user',nombre:'Usuario de prueba',email:'ejemplo@example.com',rol:'admin',notif_habilitadas:true,notif_sonido:false},permisos:${JSON.stringify(['dashboard','quejas','mis_quejas','documentos','sacp','riesgos','auditorias','revision','procesos','usuarios','reporteria','configuracion'].map(modulo=>({modulo,leer:true,escribir:true})))},initialized:true,loading:false,init:()=>{},logout:()=>{},setPrefs:()=>{}}; export const useAuthStore=fn=>fn(state);`
      else {
        for(const name of names.get(args.path) || []) {
          if(name==='supabase') contents += "export const supabase={auth:{getSession:async()=>({data:{session:null}})}};"
          else if(name==='SONIDOS_NOTIFICACION') contents += 'export const SONIDOS_NOTIFICACION=[];'
          else if(name==='useHoverPrefetch') contents += 'export const useHoverPrefetch=()=>()=>{};'
          else if(name.startsWith('use')) contents += `export const ${name}=()=>({data:${JSON.stringify(queryData[name] ?? [])},isPending:false,isLoading:false,isError:false,isFetching:false,refetch:()=>{},mutate:()=>{},mutateAsync:async()=>{}});`
          else if(name.endsWith('Key')) contents += `export const ${name}=()=>['fixture'];`
          else if(name.endsWith('Keys') || name==='queryKeys') contents += `export const ${name}={quejas:['quejas'],dashboard:['dashboard']};`
          else if(name==='PAGE_SIZE') contents += 'export const PAGE_SIZE=25;'
          else contents += `export const ${name}=()=>{};`
        }
      }
      return {contents,loader:'js',resolveDir:root}
    })
  }}]
})
const css = await postcss([tailwind()]).process(fs.readFileSync('app/globals.css','utf8'), {from:path.join(root,'app/globals.css')})
const fonts=[300,400,500,600,700].map(w=>fs.readFileSync('node_modules/@fontsource/inter/latin-'+w+'.css','utf8').replaceAll('./files/','/fonts/')).join('\n')
const styles=fonts+'\n'+css.css+'\n'+fs.readFileSync('app/coreui.generated.css','utf8')+'\n'+fs.readFileSync('app/coreui-adapter.css','utf8')
http.createServer((req,res)=>{
  if(req.url==='/reference' && process.argv[2]) {res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(process.argv[2]))}
  else if(/^\/fonts\/[a-z0-9-]+\.woff2?$/.test(req.url)) {res.setHeader('Content-Type','font/woff2');res.end(fs.readFileSync('node_modules/@fontsource/inter/files/'+path.basename(req.url)))}
  else if(req.url==='/preview.js') {res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].text)}
  else if(req.url==='/preview.css') {res.setHeader('Content-Type','text/css');res.end(styles)}
  else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>ECA-QMS · comprobación visual con datos ficticios</title><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>')}
}).listen(Number(process.env.QMS_VISUAL_PORT || 4174),'127.0.0.1',()=>console.log('Visual fixture ready (synthetic data only)'))
