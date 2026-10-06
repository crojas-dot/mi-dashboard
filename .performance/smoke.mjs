import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
const root = process.cwd()
const require = createRequire(path.join(root, 'package.json'))
const out = path.join(root, '.performance/smoke')
fs.mkdirSync(out, { recursive: true })
const entry = `
import React, { Suspense, useState } from 'react';
import {createRoot} from 'react-dom/client';
import {CButton,CFormInput} from '@coreui/react';
import DeferredMount from '@/components/ui/DeferredMount';
import Modal from '@/components/Modal';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import NuevaQuejaModal from '@/app/quejas/components/NuevaQuejaModal';
import UsuarioFormModal from '@/components/usuarios/UsuarioFormModal';
function Form({open,onClose}) {
 const [draft,setDraft]=useState(''),[child,setChild]=useState(false);
 return <Modal open={open} title="Nueva queja de prueba" onClose={onClose}>
 <CFormInput aria-label="Descripción" value={draft} onChange={e=>setDraft(e.target.value)}/>
 <CButton onClick={()=>setChild(true)}>Abrir confirmación</CButton>
 <Modal open={child} title="Confirmación de prueba" onClose={()=>setChild(false)}>Confirmación local</Modal>
 </Modal>;
}
function UserTest(){const [open,setOpen]=useState(false),[saved,setSaved]=useState(false);return <><CButton onClick={()=>{setSaved(false);setOpen(true)}}>Probar usuario</CButton>{saved && <p>Usuario ficticio guardado</p>}<DeferredMount active={open}><UsuarioFormModal open={open} mode="crear" onClose={()=>setOpen(false)} onSuccess={()=>{setOpen(false);setSaved(true)}} onDelete={async()=>{}} /></DeferredMount></>}
function App(){const [open,setOpen]=useState(false),[detail,setDetail]=useState(false),[page,setPage]=useState(0),[error,setError]=useState(false);return <Suspense fallback={<p>Loading global…</p>}>
 <div className="coreui-scope p-4"><header className="mb-4"><h1>Prueba aislada de primera apertura</h1><p>Datos ficticios. Sin conexión a servicios.</p></header>
 <CButton onClick={()=>setError(true)}>Simular fallo de conexión</CButton>
 {error && <ErrorState error={new TypeError("Failed to fetch")} title="No se pudieron cargar las evidencias" onRetry={()=>setError(false)} />}
 <UserTest/><nav aria-label="Menú principal">ECA QMS · Quejas</nav>
 <div className="d-flex gap-2 my-3"><CButton onClick={()=>setOpen(true)}>Añadir queja</CButton><CButton color="secondary" onClick={()=>setDetail(true)}>Abrir expediente</CButton></div>
 <table className="coreui-record-table"><thead><tr><th>Folio</th></tr></thead><tbody><tr><td>QUEJA-DEMO-{page+1}</td></tr></tbody></table>
 <Pagination page={page} count={75} onChange={setPage}/>
 <DeferredMount active={open}><NuevaQuejaModal open={open} onClose={()=>setOpen(false)} onCreated={()=>{}} categorias={[{valor:"Queja",color:"blue"}]} prioridades={[{valor:"Alta",color:"red"}]}/></DeferredMount>
 <DeferredMount active={detail}><Form open={detail} onClose={()=>setDetail(false)}/></DeferredMount>
 </div></Suspense>}
createRoot(document.getElementById('root')).render(<App/>);`
await require('esbuild').build({ stdin: { contents: entry, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: path.join(out, 'bundle.js'), format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'no-network', setup(build) {
  build.onResolve({filter: /^@\/lib\/queries\/useUsuarios$/},()=>({path:'users',namespace:'mock-users'}))
  build.onLoad({filter: /.*/,namespace:'mock-users'},()=>({contents:'let calls=0; export async function mutateUsuario(){ if (++calls===1) throw new TypeError("Failed to fetch"); }',loader:'js'}))
  build.onResolve({filter: /^@\/lib\/services\/errorToast$/},()=>({path:'toasts',namespace:'mock-toast'}))
  build.onLoad({filter: /.*/,namespace:'mock-toast'},()=>({contents:'export function showError(){ document.getElementById("test-status").textContent="No se pudo conectar con el servicio"; } export function showSuccess(){ document.getElementById("test-status").textContent="Guardado correctamente"; }',loader:'js'}))
  build.onResolve({filter: /^@\/lib\/services\/quejaWorkflowService$/},()=>({path:'workflow',namespace:'mock-workflow'}))
  build.onLoad({filter: /.*/,namespace:'mock-workflow'},()=>({contents:'export async function crearQuejaInterna(){throw new Error("Prueba sin guardado")}',loader:'js'}))
  build.onResolve({ filter: /^@\/lib\/queries\/pagination$/ }, () => ({ path: 'pagination', namespace: 'local' }))
  build.onLoad({ filter: /.*/, namespace: 'local' }, () => ({ contents: 'export const PAGE_SIZE=25', loader: 'js' }))
}}] })
const postcss=require('postcss'), tailwind=require('@tailwindcss/postcss')
const css=await postcss([tailwind()]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8'), {from:path.join(root,'app/globals.css')})
fs.writeFileSync(path.join(out,'global.css'),css.css)
http.createServer((req,res)=>{
 const file=['/bundle.js','/bundle.css','/global.css'].includes(req.url) ? req.url.slice(1) : null
 res.setHeader('Content-Type', file ? file.endsWith('.css')?'text/css':'text/javascript' : 'text/html; charset=utf-8')
 res.end(file ? fs.readFileSync(path.join(out,file)) : '<!doctype html><html lang="es"><meta charset="utf-8"><title>Prueba local QMS</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/bundle.css"><div id="test-status" role="status"></div><div id="root"></div><script type="module" src="/bundle.js"></script></html>')
}).listen(3102,'127.0.0.1',()=>console.log('Prueba local: http://127.0.0.1:3102'))
