import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'

const mocks = {
  'next/navigation': `export const usePathname=()=>'/configuracion';export const useRouter=()=>({replace(){},push(){}});`,
  'next/link': `import React from 'react';export default function Link({children,...props}){return <a {...props} onClick={event=>event.preventDefault()}>{children}</a>}`,
  '@/lib/store/auth-store': `import {create} from 'zustand';const user={id:'demo',nombre:'Equipo de Calidad',email:'demo@example.test',rol:'admin',notif_habilitadas:false};export const useAuthStore=create(set=>({user,initialized:true,loading:false,init(){},logout(){},vistaActiva:null,permisos:['dashboard','quejas','mis_quejas','documentos','sacp','riesgos','auditorias','revision','procesos','usuarios','reporteria','configuracion'].map(modulo=>({modulo,leer:true,escribir:true})),setVistaActiva:async vistaActiva=>set({vistaActiva}),setPrefs(){},setNotifSonidoId(){}}));`,
  '@/hooks/useRealtimeSubscription': `export function useRealtimeSubscription(){}`,
  '@/lib/services/errorToast': `export function showError(error,fallback){console.warn(fallback)} export function showSuccess(message){console.log(message)}`,
}
const bundle = await build({ entryPoints: ['.performance/settings-preview-app.tsx'], bundle: true, write: false, outfile: '.performance/settings-preview/bundle.js', platform: 'browser', format: 'iife', jsx: 'automatic', plugins: [{ name: 'local-fixture', setup(builder) {
  builder.onResolve({filter:/^@\/lib\/supabase$/},()=>({path:path.resolve('.performance/settings-preview-data.ts')}))
  builder.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined)
  builder.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:process.cwd()}))
} }] })
const css = (await postcss([tailwind({ optimize: false })]).process(fs.readFileSync('app/globals.css','utf8'),{from:path.resolve('app/globals.css')})).css
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ECA-QMS · vista local con datos ficticios</title><style>${css}body{font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`
fs.mkdirSync('.performance/settings-preview',{recursive:true})
fs.writeFileSync('.performance/settings-preview/index.html',html)
http.createServer((_request,response)=>{response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(html)}).listen(3027,'127.0.0.1',()=>console.log('Preview local: http://localhost:3027 · datos ficticios'))
