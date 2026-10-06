import fs from 'node:fs'
import ts from 'typescript'
let server=fs.readFileSync('.performance/views-preview-server.mjs','utf8')
server=server.replace("path:'/procesos'","path:'/'").replace('user,permisos:full,logout','user,initialized:true,permisos:full,logout')
server=server.replace("const modules = {",`const modules = {
  'next/dynamic': "import React,{lazy,Suspense} from 'react';export default function dynamic(loader){const Component=lazy(loader);return props=><Suspense fallback={null}><Component {...props}/></Suspense>}",
  '@/lib/services/quejaWorkflowService': "export const crearQueja=async()=>({}), crearQuejaInterna=crearQueja, actualizarAtributosQueja=crearQueja, actualizarDetallesQueja=crearQueja, transicionarQueja=crearQueja, derivarQuejaASACP=crearQueja, agregarComentarioQueja=crearQueja, subirAdjuntoQueja=crearQueja, eliminarAdjuntoQueja=crearQueja, descargarAdjuntoQueja=crearQueja, reabrirQueja=crearQueja;",
  '@/lib/services/aiService': "export const analizarIA=async()=>({texto:'Prueba visual local'});",
`)
const records=`[{id:'test-q1',folio:'2026-001',cliente_nombre:'Organización de prueba',email_cliente:'calidad@example.test',categoria:'Queja',tipo:'Queja',estado:'Recibido',prioridad:'Media',fecha:'2026-10-05T12:00:00Z',fecha_recepcion_gc:'2026-10-05',descripcion:'Se solicita revisar el proceso de atención y documentar las oportunidades de mejora.',responsable_id:'test-user'}, {id:'test-q2',folio:'2026-002',cliente_nombre:'Equipo de acreditación',categoria:'Observación',tipo:'Observación',estado:'En Investigación',prioridad:'Alta',fecha:'2026-10-02T12:00:00Z',notas:'Revisar las evidencias de la investigación.',responsable_id:'test-user'}, {id:'test-q3',folio:'2026-003',cliente_nombre:'Empresa de prueba',categoria:'Sugerencia',tipo:'Sugerencia',estado:'Resuelto',prioridad:'Baja',fecha:'2026-09-12T12:00:00Z',resolucion:'Se actualizó el procedimiento.',responsable_id:'test-user'}]`
const extra=`
const result=data=>({data,isLoading:false,isPending:false,isFetching:false,error:null,refetch:()=>{}});
const sampleQuejas=${records};
export const useQuejas=()=>result({data:sampleQuejas,count:3});
export const useDashboard=()=>result({indicadores:[],tareas:[{id:'t1',titulo:'Revisión de atención',tipo:'Queja',entidad:'Quejas',vence:'2026-10-12',estado:'Recibido',prioridad:'Media'}]});
export const useZonaHoraria=()=>result('America/Costa_Rica');
export const useGeneralTotales=modules=>result(modules.map((m,i)=>({id:m.id,total:17-i*2})));
export const useUsuarios=()=>result([{id:'test-user',nombre:'Equipo Calidad',rol:'calidad',estado:'activo'}]);
export const quejaAdjuntosKey=id=>['adjuntos',id],comentariosKey=id=>['comentarios',id],quejaActividadKey=id=>['actividad',id];
export const useCatalogos=()=>result([{id:'c1',modulo:'quejas',tipo:'categoria_queja',valor:'Queja',activo:true,orden:1},{id:'c2',modulo:'quejas',tipo:'categoria_queja',valor:'Observación',activo:true,orden:2}]);
export const useQuejasAnalisis=()=>result({anio:2026,series:['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct'].map((mes,i)=>({mes,recibidas:i%3+1,resueltas:i%2})),porEstado:[{etiqueta:'Recibido',total:1},{etiqueta:'En Investigación',total:1},{etiqueta:'Resuelto',total:1}],porCategoria:[{etiqueta:'Queja',total:1},{etiqueta:'Observación',total:1}],activas:sampleQuejas.slice(0,2),atencion:sampleQuejas.slice(0,2)});
`
const exported=new Set([...server.matchAll(/(?:export const |,)(\w+)\s*=/g)].map(m=>m[1]))
for(const m of extra.matchAll(/(?:export const |,)(\w+)\s*=/g))exported.add(m[1])
const wanted=new Set()
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())scan(f);else if(/\.tsx?$/.test(f)){const src=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true);for(const n of src.statements)if(ts.isImportDeclaration(n)&&n.moduleSpecifier.text.startsWith('@/lib/queries/')&&!n.moduleSpecifier.text.endsWith('/queryKeys')&&!n.moduleSpecifier.text.endsWith('/pagination'))for(const imp of n.importClause?.namedBindings?.elements??[])if(!imp.isTypeOnly)wanted.add(imp.name.text)}}}scan('app');scan('components')
const generic=[...wanted].filter(n=>!exported.has(n)).map(n=>`export const ${n}=${n.startsWith('use')?"()=>({...result([]), mutate:()=>{},mutateAsync:async()=>({}),isPending:false})":n.endsWith('Key')||n.endsWith('key')?`['mock-${n}']`:"()=>Promise.resolve([])"};`).join('\n')
server=server.replace("const output = await build",`const extraQueries=${JSON.stringify(extra+generic)};\nconst output = await build`)
server=server.replace("if (args.path.startsWith('@/lib/queries/'))", "if (args.path.startsWith('@/lib/queries/') && !args.path.endsWith('/queryKeys') && !args.path.endsWith('/pagination'))")
server=server.replace("args.path==='queries'?queries:modules[args.path]","args.path==='queries'?queries+extraQueries:modules[args.path]")
server=server.replace("const css=(await compile('app/globals.css'))+(await compile('app/styles/ui-kit.css'))", "const css=(await compile('app/globals.css'))")
server=server.replace('views-preview-app.tsx','final-preview-app.tsx').replace('views-fixture.js','final-fixture.js').replace('views-preview.html','final-preview.html')
fs.writeFileSync('.performance/final-preview-server.mjs',server)
let app=fs.readFileSync('.performance/views-preview-app.tsx','utf8').replace("const routes=", "import Dashboard from '@/app/page';import Quejas from '@/app/quejas/page';import MisQuejas from '@/app/mis-quejas/page';import Configuracion from '@/app/configuracion/page';\nconst routes=")
app=app.replace("{ '/procesos'", "{ '/':Dashboard,'/quejas':Quejas,'/mis-quejas':MisQuejas,'/configuracion':Configuracion,'/procesos'")
fs.writeFileSync('.performance/final-preview-app.tsx',app)
