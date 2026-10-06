import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
const root=process.cwd(),out=path.join(root,'.performance/zona-preview');
fs.mkdirSync(out,{recursive:true});
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Zona from '@/app/configuracion/components/ZonaHorariaEditor';createRoot(document.getElementById('root')).render(<div className="coreui-scope p-4" style={{maxWidth:1000}}><h1 className="fs-3 mb-4">Configuración general</h1><Zona/></div>);`,loader:'tsx',resolveDir:root},bundle:true,format:'esm',jsx:'automatic',outfile:path.join(out,'bundle.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated',setup(b){
b.onResolve({filter:/^@\/lib\/queries\/useZonaHoraria$/},()=>({path:'zona',namespace:'mock'}));
b.onResolve({filter:/^@tanstack\/react-query$/},()=>({path:'query',namespace:'mock'}));
b.onResolve({filter:/^@\/lib\/services\/errorToast$/},()=>({path:'toast',namespace:'mock'}));
b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='zona'?`export const zonaHorariaKey=['configuraciones_sistema','org.zona_horaria'];export const useZonaHoraria=()=>({data:'America/Costa_Rica',error:null,isPending:false,isFetching:false,refetch:()=>{}});export const guardarZonaHoraria=async z=>z;`:a.path==='query'?`export const useQueryClient=()=>({setQueryData:()=>{},invalidateQueries:async()=>{}});`:`export const showSuccess=()=>{};`,loader:'js'}));
}}]});
http.createServer((req,res)=>{let file=['/bundle.js','/bundle.css','/global.css'].includes(req.url)?req.url.slice(1):null;let target=file?file==='global.css'?path.join(root,'.performance/smoke/global.css'):path.join(out,file):null;res.setHeader('Content-Type',file?file.endsWith('.css')?'text/css':'text/javascript':'text/html; charset=utf-8');res.end(target?(fs.existsSync(target)?fs.readFileSync(target):''):'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/bundle.css"><div id="errors" style="color:red"></div><script>window.onerror=(message)=>document.getElementById("errors").textContent=String(message);window.onunhandledrejection=(event)=>document.getElementById("errors").textContent=String(event.reason);</script><div id="root"></div><script type="module" src="/bundle.js"></script></html>')}).listen(3105,'127.0.0.1',()=>console.log('Vista de Configuración: http://127.0.0.1:3105'));
