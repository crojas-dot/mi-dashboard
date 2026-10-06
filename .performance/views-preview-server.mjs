import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'

const modules = {
  'next/navigation': `import {create} from 'zustand'; const route=create(()=>({path:'/procesos'})); export const usePathname=()=>route(s=>s.path); export const useRouter=()=>({push:path=>route.setState({path}),replace:path=>route.setState({path})});`,
  'next/link': `import React from 'react'; import {useRouter} from 'next/navigation'; export default function Link({href,onClick,children,...props}){const router=useRouter();return <a {...props} href={href} onClick={e=>{e.preventDefault();onClick?.(e);router.push(href)}}>{children}</a>}`,
  '@/lib/store/auth-store': `import {create} from 'zustand'; const user={id:'test-user',nombre:'Equipo Calidad',email:'ejemplo@example.test',rol:'admin',notif_habilitadas:true,notif_sonido:true}; const full=['dashboard','quejas','mis_quejas','documentos','sacp','riesgos','auditorias','revision','procesos','usuarios','reporteria','configuracion'].map(modulo=>({modulo,leer:true,escribir:true})); export const useAuthStore=create(set=>({user,permisos:full,logout:()=>set({user:null}),setPrefs:prefs=>set(s=>({user:{...s.user,...prefs}})),setRestricted:value=>set({user:{...user,rol:value?'colaborador':'admin'},permisos:value?[{modulo:'mis_quejas',leer:true}]:full})}));`,
  '@/lib/supabase': `export {supabase} from './.performance/views-preview-db';`,
  '@/lib/services/folioService': `export const generarFolio=async tipo=>tipo.toUpperCase()+'-TEST-002';`,
  '@/hooks/useRealtimeSubscription': `export function useRealtimeSubscription(){}`,
  '@/lib/services/sonidosNotificacion': `export const SONIDO_DEFAULT='notification/info'; export const SONIDOS_NOTIFICACION=[{id:SONIDO_DEFAULT,label:'Info'},{id:'game/coin',label:'Moneda'}];export function playNotificationSound(){}`,
  '@/lib/services/errorToast': `export function showError(){} export function showSuccess(){}`,
}
const queries = `
import {useMemory} from './.performance/views-preview-db';
const useList=(table,estado='')=>{const data=useMemory(state=>state[table]);const filtered=estado?data.filter(row=>row.estado===estado):data;return {data:{data:filtered,count:filtered.length},isLoading:false,isFetching:false,error:null,refetch:()=>{}}};
export const useProcesos=()=>useList('procesos'),useAuditorias=()=>useList('auditorias'),useRiesgos=()=>useList('riesgos'),useReuniones=()=>useList('reuniones'),useDocumentos=(_page,estado)=>useList('documentos',estado);
export const useHallazgos=()=>({data:[{id:'h1',descripcion:'Hallazgo de prueba',tipo:'Observacion'}]}),useMatrizRiesgos=()=>({data:[{p:2,i:2,count:1}],isPending:false,isFetching:false,error:null,refetch:()=>{}});

import {create} from 'zustand';
const notifications=create(()=>({data:[{id:'n1',leida:false,mensaje:'Se recibió una nueva queja',fecha:'2026-10-05T12:00:00Z',enlace:'/quejas',origen_id:'test-q'},{id:'n2',leida:true,mensaje:'Informe disponible',fecha:'2026-10-05T11:00:00Z'}]}));
export const useNotificaciones=()=>notifications(s=>s);
const mutation=fn=>({mutate:fn,mutateAsync:async data=>fn(data)});
export const useMarcarNotificacionLeida=()=>mutation(({id})=>notifications.setState(s=>({data:s.data.map(n=>n.id===id?{...n,leida:true}:n)})));
export const useMarcarTodasLeidas=()=>mutation(()=>notifications.setState(s=>({data:s.data.map(n=>({...n,leida:true}))})));
export const useArchivarNotificacion=()=>mutation(({id})=>notifications.setState(s=>({data:s.data.filter(n=>n.id!==id)})));
export const useArchivarTodas=()=>mutation(()=>notifications.setState({data:[]}));
export const notificacionesKey=id=>['notificaciones',id];
export const dashboardKey=['dashboard'],documentosKey=['documentos'],accionesKey=['acciones'],riesgosKey=['riesgos'],auditoriasKey=['auditorias'],reunionesKey=['reuniones'],procesosKey=['procesos'];
export const quejasKey=p=>['quejas',p],usuariosQueryKey=()=>['usuarios'],paginaKey=key=>[...key,0,25];
export const fetchDashboard=async()=>[],fetchQuejas=fetchDashboard,fetchDocumentos=fetchDashboard,fetchAcciones=fetchDashboard,fetchRiesgos=fetchDashboard,fetchAuditorias=fetchDashboard,fetchReuniones=fetchDashboard,fetchProcesos=fetchDashboard,fetchUsuariosDirect=fetchDashboard;
`
const output = await build({ entryPoints: ['.performance/views-preview-app.tsx'], outfile: '.performance/views-fixture.js', bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'local-test-data', setup(api) {
  api.onResolve({filter:/^(next\/|@\/)/}, args => {
    if (args.path.startsWith('@/lib/queries/')) return {path:'queries',namespace:'mock'}
    if (modules[args.path]) return {path:args.path,namespace:'mock'}
  })
  api.onLoad({filter:/.*/,namespace:'mock'}, args => ({contents:args.path==='queries'?queries:modules[args.path],loader:'tsx',resolveDir:process.cwd()}))
} }] })
const compile = async file => (await postcss([tailwind({optimize:false})]).process(fs.readFileSync(file,'utf8'),{from:path.resolve(file)})).css
const css=(await compile('app/globals.css'))+(await compile('app/styles/ui-kit.css'))+(output.outputFiles.find(file=>file.path.endsWith('.css'))?.text??'')
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prueba local del shell Tailwind</title><style>${css}</style></head><body><div id="root"></div><script>${output.outputFiles.find(file=>file.path.endsWith('.js')).text}</script></body></html>`
fs.writeFileSync('.performance/views-preview.html',html)
http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)}).listen(3011,'127.0.0.1',()=>console.log('Shell fixture http://localhost:3011'))
