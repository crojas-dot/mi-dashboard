import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient } from '@tanstack/react-query'
import { loadModule } from './load-module.mjs'

let calls=0, aborted
const sample = { id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',codigo:'2026-090',descripcion:'Revisar expediente',motivo:'vence_hoy',ruta:'/quejas',fecha_limite:'2026-11-11' }
const api=loadModule('lib/queries/useAgendaHoy.ts',{
  '@/lib/supabase':{supabase:{rpc(name){assert.equal(name,'qms_get_agenda_hoy');calls++;const p=Promise.resolve({data:[sample],error:null});p.abortSignal=signal=>{aborted=signal;return p};return p}}},
})
const linkMock={'next/link':{default:({href,children,...props})=>createElement('a',{...props,href,prefetch:undefined},children)}}
const {default:Widget}=loadModule('components/ui/AgendaHoyWidget.tsx',{...linkMock,react:{...React,useState:initial=>[initial==='calendario'?'agenda':initial,()=>{}]}})
const render=(props={})=>renderToStaticMarkup(createElement(Widget,{open:true,items:[sample],onToggle(){},onClose(){},onRetry(){},...props}))

test('contrato exacto: rechaza rutas externas, motivos ajenos, duplicados y exceso de filas',()=>{
  assert.equal(api.parseAgendaHoy([sample])[0].codigo,'2026-090')
  for(const motivo of ['recibida_hoy','vence_en_1_dia','revision_hoy','lista_publicar_hoy'])assert.equal(api.parseAgendaHoy([{...sample,motivo}])[0].motivo,motivo)
  for(const value of [null,{},[null],[{...sample,ruta:'https://example.test'}],[{...sample,ruta:'//evil.test'}],[{...sample,motivo:'__proto__'}],[{...sample,secreto:'x'}],[sample,sample],Array(21).fill(sample)]) assert.throws(()=>api.parseAgendaHoy(value))
  assert.deepEqual(api.parseAgendaHoy([]),[])
  assert.throws(()=>api.parseAgendaHoy([{...sample,fecha_limite:'2026-02-31'}]))
  assert.throws(()=>api.parseAgendaHoy([{...sample,fecha_limite:'2026-11-11T00:00:00Z'}]))
})

test('los puntos usan fechas civiles reales y un único color por prioridad',()=>{
  const {puntosAgenda}=loadModule('lib/utils/agendaCalendar.ts')
  const puntos=puntosAgenda([
    {...sample,motivo:'vence_en_2_dias'},
    {...sample,motivo:'nueva_asignacion'},
    sample,
    {...sample,motivo:'vence_en_2_dias',fecha_limite:'2026-11-13'},
    {...sample,fecha_limite:null},
  ])
  assert.equal(puntos.size,2)
  assert.equal(puntos.get('2026-11-11'),'vence_hoy')
  assert.equal(puntos.get('2026-11-13'),'vence_en_2_dias')
})
test('caché de cinco minutos, cancelación y separación por identidad',async()=>{
  calls=0;const client=new QueryClient({defaultOptions:{queries:{retry:false}}})
  try{
    const options=api.agendaHoyOptions('user-a')
    assert.equal(options.staleTime,300000)
    assert.equal(api.agendaHoyOptions('').enabled,false)
    await client.fetchQuery(options);await client.fetchQuery(options)
    assert.equal(calls,1);assert.ok(aborted instanceof AbortSignal)
    await client.fetchQuery(api.agendaHoyOptions('user-b'));assert.equal(calls,2)
    await client.invalidateQueries({queryKey:['dashboard']})
    await client.fetchQuery(options);assert.equal(calls,3)
  }finally{client.clear()}
})
test('muestra cinco tarjetas y Ver más dentro de la lista solo cuando quedan pendientes',()=>{
  const items=Array.from({length:20},(_,i)=>({...sample,id:String(i),codigo:'Caso '+i}))
  const html=render({items})
  assert.equal((html.match(/<li>/g)||[]).length,5)
  assert.equal((html.match(/<button/g)||[]).length,3)
  assert.match(html,/Volver al calendario/)
  assert.match(html,/Caso 4/);assert.doesNotMatch(html,/Caso 5/);assert.match(html,/max-h-80/);assert.match(html,/overscroll-contain/)
  assert.doesNotMatch(html,/href="\/dashboard"/);assert.match(html,/Ver más/)
  assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/bg-red-500/)
  assert.doesNotMatch(render({items:items.slice(0,5)}),/href="\/dashboard"/)
  assert.doesNotMatch(render({items:items.slice(0,5)}),/Ver más/)
})

test('abre en calendario, navega a la lista y vuelve; una nueva apertura restablece el calendario',()=>{
  const states=[];let cursor=0,open=true
  const {default:Component}=loadModule('components/ui/AgendaHoyWidget.tsx',{...linkMock,react:{...React,
    useId:()=> 'agenda-fixture',useRef:()=>({current:null}),useEffect(){},
    useState:initial=>{const index=cursor++;states[index]??=initial;return[states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value}]},
  }})
  const items=Array.from({length:8},(_,i)=>({...sample,id:String(i)}))
  const props=()=>({open,items,onToggle(){open=!open},onClose(){open=false},onRetry(){}})
  const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value?.props?[value,...nodes(value.props.children)]:[]
  const render=()=>{cursor=0;return nodes(Component(props()))}
  assert.ok(render().some(n=>n.props['data-agenda-calendar']!==undefined))
  render().find(n=>n.type==='button'&&n.props.children==='Ver agenda').props.onClick()
  assert.equal(states[0],'agenda')
  assert.ok(render().some(n=>n.type==='ul'))
  render().find(n=>n.type==='button'&&n.props.children==='Ver más').props.onClick()
  assert.equal(render().filter(n=>n.type==='li').length,8)
  assert.equal(render().some(n=>n.type==='button'&&n.props.children==='Ver más'),false)
  render().find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children.includes('Volver al calendario')).props.onClick()
  assert.equal(states[0],'calendario')
  render().find(n=>n.props['aria-label']==='Mes siguiente').props.onClick()
  assert.equal(states[1],1)
  render().find(n=>n.props['aria-label']==='Mes anterior').props.onClick()
  assert.equal(states[1],0)
  render().find(n=>n.type==='button'&&n.props.children==='Ver agenda').props.onClick()
  open=false
  render().find(n=>n.props['aria-haspopup']==='dialog').props.onClick()
  assert.equal(open,true);assert.equal(states[0],'calendario');assert.equal(states[1],0)
  assert.equal(states[3],false)
})

test('el calendario muestra el mes civil de Costa Rica, domingo y navegación entre años',()=>{
  const {crearMesAgenda}=loadModule('lib/utils/agendaCalendar.ts')
  const noviembre=crearMesAgenda(new Date('2026-11-11T18:00:00Z'))
  assert.equal(noviembre.titulo,'noviembre de 2026');assert.equal(noviembre.hoy,11)
  assert.deepEqual(Array.from(noviembre.semanas[0]),[1,2,3,4,5,6,7])
  assert.equal(noviembre.semanas.flat().filter(Boolean).length,30)
  assert.equal(crearMesAgenda(new Date('2028-02-15T18:00:00Z')).semanas.flat().filter(Boolean).length,29)
  assert.equal(crearMesAgenda(new Date('2027-01-01T05:59:59Z')).titulo,'diciembre de 2026')
  assert.equal(crearMesAgenda(new Date('2027-01-01T06:00:00Z')).titulo,'enero de 2027')
  assert.equal(crearMesAgenda(new Date('2026-11-11T18:00:00Z'),2).titulo,'enero de 2027')
  assert.equal(crearMesAgenda(new Date('2026-01-11T18:00:00Z'),-1).titulo,'diciembre de 2025')
  const {default:Calendar}=loadModule('components/ui/AgendaHoyWidget.tsx',linkMock)
  const html=renderToStaticMarkup(createElement(Calendar,{open:true,items:[sample],onToggle(){},onClose(){},onRetry(){}}))
  assert.match(html,/Ver agenda/);assert.match(html.replace(/<[^>]*>/g,''),/1 tarea hoy/)
  assert.match(html,/aria-current="date"/);assert.doesNotMatch(html,/<li>/)
  assert.doesNotMatch(html,/href="\/dashboard"|Ver panel de control completo|<table/)
  assert.match(html,/rounded-full/);assert.match(html,/Mes anterior/);assert.match(html,/Mes siguiente/)
})
test('vacío, carga, error y cerrado son distintos; el contenido no se interpreta como HTML',()=>{
  assert.match(render({items:[]}),/No hay tareas urgentes/)
  assert.doesNotMatch(render({items:[]}),/bg-red-500/)
  assert.match(render({loading:true}),/Cargando agenda/)
  assert.match(render({error:true}),/Reintentar/)
  assert.doesNotMatch(render({open:false}),/role="dialog"/)
  assert.match(render({items:[{...sample,descripcion:'<script>alert(1)</script>'}]}),/&lt;script&gt;/)
})

test('el alias /dashboard conserva el módulo y redirige al panel existente',()=>{
  const {moduloDeRuta}=loadModule('lib/permisos.ts')
  assert.equal(moduloDeRuta('/dashboard'),'dashboard')
  let target
  const {default:Alias}=loadModule('app/dashboard/page.tsx',{'next/navigation':{redirect:href=>{target=href}}})
  Alias();assert.equal(target,'/')
})
