import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const provider = { id:'p1', nombre:'Ejemplo', tipo:'openai', api_key:'', has_api_key:true, modelos:['example-model'], tokens_usados:43, limite_tokens:100 }
function harness({save,initialProvider=provider,testResponse=async options=>Response.json({modelo:JSON.parse(options.body).modelo,ok:true,latenciaMs:1,error:null})}={}) {
  const slots=[], queued=[], calls=[], errors=[];let cursor=0,tree
  const state=initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value}]}
  const effect=(callback,deps)=>{const index=cursor++,previous=slots[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i]))){slots[index]={deps,cleanup:previous?.cleanup};queued.push(()=>{slots[index].cleanup?.();slots[index].cleanup=callback()})}}
  const {default:Manager}=loadModule('components/configuracion/AIProvidersManager.tsx',{
    react:{useState:state,useRef:current=>state({current})[0],useEffect:effect},
    'lucide-react':new Proxy({}, {get:(_,key)=>key}),
    '@/components/ui/LoadingSkeleton':{default:'LoadingSkeleton'},'@/components/ui/Spinner':{default:'Spinner'},
    '@/components/ui/Select':{default:'Select'},'@/components/ui/Button':{default:'Button'},
    '@/components/Modal':{default:'Modal'},'@/components/ui/ErrorState':{default:'ErrorState'},
    '@/components/configuracion/AIProviderList':{default:'AIProviderList'},
    '@/lib/queries/useUsuarios':{apiFetch:async(_url,options)=>{calls.push(['model-test',options]);return testResponse(options)}},
    '@/lib/services/aiConfigService':{
      cargarConfigIA:async signal=>{calls.push(['load',signal]);return {providers:[initialProvider],routing:{},ttl:1440,revision:'initial-revision'}},
      guardarProveedoresIA:async(...args)=>{calls.push(['save',...args]);return save?await save(...args):{valor:args[0].map(p=>({...p,api_key:'',has_api_key:true})),revision:'saved-revision'}},
      guardarConfigIA:async(...args)=>calls.push(['setting',...args]),modelosIA:async()=>({modelos:['example-model'],total:1,descartados:0}),
      conectarIA:async value=>calls.push(['connect',value]),limpiarMemoriaIA:async()=>{},modelosSinFallos:async(_,value)=>value,
    },
    '@/lib/services/errorToast':{showError:(...args)=>errors.push(args),showSuccess(){}},
  })
  const visit=value=>Array.isArray(value)?value.flatMap(visit):value?.props?[value,...visit(value.props.children)]:[]
  const text=value=>Array.isArray(value)?value.map(text).join(''):value?.props?text(value.props.children):typeof value==='string'?value:''
  const render=()=>{cursor=0;tree=Manager();while(queued.length)queued.shift()();return tree}
  return {calls,errors,render,ready:async()=>{render();await new Promise(resolve=>setTimeout(resolve,0));render()},
    node:type=>visit(tree).find(n=>n.type===type),button:label=>visit(tree).find(n=>n.type==='Button'&&text(n).trim()===label),
    input:placeholder=>visit(tree).find(n=>n.type==='input'&&n.props.placeholder===placeholder),
    nodes:()=>visit(tree),unmount:()=>slots.forEach(value=>value?.cleanup?.()),}
}

test('editar conserva clave vacía, envía revisión explícita y bloquea un doble guardado',async()=>{
  let finish;const pending=new Promise(resolve=>{finish=resolve});const h=harness({save:()=>pending});await h.ready()
  h.node('AIProviderList').props.onEdit(provider);h.render()
  const field=h.input('Dejar vacío para conservar la clave');assert.equal(field.props.value,'')
  const save=h.button('Guardar Cambios').props.onClick;const request=save();await save()
  assert.equal(h.calls.filter(c=>c[0]==='save').length,1);assert.equal(h.calls.at(-1)[2],'initial-revision');assert.equal(h.calls.at(-1)[1][0].api_key,'')
  h.render();const modal=h.nodes().find(n=>n.type==='Modal'&&n.props.title==='Editar Proveedor');modal.props.onClose();h.render();assert.equal(h.nodes().find(n=>n.type==='Modal'&&n.props.title==='Editar Proveedor').props.open,true)
  finish({valor:[provider],revision:'saved-revision'});await request;h.render();assert.equal(h.node('AIProviderList').props.providers[0].tokens_usados,43)
  h.unmount();assert.equal(h.calls[0][1].aborted,true)
})
test('un conflicto no cierra el editor ni avanza su revisión para forzar el guardado',async()=>{
  const h=harness({save:async()=>{throw Object.assign(new Error('Recarga antes de guardar'),{status:409})}});await h.ready()
  h.node('AIProviderList').props.onEdit(provider);h.render();await h.button('Guardar Cambios').props.onClick();h.render()
  assert.equal(h.nodes().find(n=>n.type==='Modal'&&n.props.title==='Editar Proveedor').props.open,true);assert.equal(h.errors.length,1)
  await h.button('Guardar Cambios').props.onClick();assert.equal(h.calls.filter(c=>c[0]==='save').length,2);assert.equal(h.calls.at(-1)[2],'initial-revision')
})
test('probar conexión usa el borrador actual y no el proveedor anterior',async()=>{
  const h=harness();await h.ready();h.node('AIProviderList').props.onEdit(provider);h.render()
  h.input('Dejar vacío para conservar la clave').props.onChange({target:{value:'test-only-new-key'}});h.render()
  await h.button('Probar Conexión').props.onClick();assert.equal(h.calls.at(-1)[0],'connect');assert.equal(h.calls.at(-1)[1].api_key,'test-only-new-key')
})
test('reiniciar consumo envía solo el ID solicitado y conserva el listado si falla',async()=>{
  const h=harness({save:async()=>{throw new Error('fixture failure')}});await h.ready();await h.node('AIProviderList').props.onReset('p1');h.render()
  const call=h.calls.find(c=>c[0]==='save');assert.deepEqual(Array.from(call[3]),['p1']);assert.equal(h.node('AIProviderList').props.providers[0].tokens_usados,43)
})

test('el test acotado conserva modelos no probados y no deja spinners permanentes',async()=>{
  const all={...provider,modelos:Array.from({length:25},(_,i)=>'model-'+i)}
  const h=harness({initialProvider:all});await h.ready();h.node('AIProviderList').props.onTest('p1');h.render()
  await h.button('Iniciar test').props.onClick();h.render()
  assert.equal(h.calls.filter(c=>c[0]==='model-test').length,20)
  assert.equal(h.node('AIProviderList').props.providers[0].modelos.length,25)
  assert.equal(h.node('AIProviderList').props.testInProgress,false)
  assert.equal(Object.values(h.node('AIProviderList').props.testProgress).filter(v=>v==='probando').length,0)
})
test('un guardado rechazado después de test no deja la operación en curso',async()=>{
  const h=harness({save:async()=>{throw Error('fixture conflict')}});await h.ready();h.node('AIProviderList').props.onTest('p1');h.render()
  await h.button('Iniciar test').props.onClick();h.render();assert.equal(h.node('AIProviderList').props.testInProgress,false)
  assert.equal(h.node('AIProviderList').props.providers[0].modelos.length,1)
})
test('cancelar el test no escribe resultados parciales ni recorta la lista',async()=>{
  let abort;const h=harness({testResponse:()=>new Promise((_resolve,reject)=>{abort=()=>reject(new DOMException('Aborted','AbortError'))})});await h.ready();h.node('AIProviderList').props.onTest('p1');h.render()
  const request=h.button('Iniciar test').props.onClick();h.render()
  const modal=h.nodes().find(n=>n.type==='Modal'&&n.props.title.startsWith('Testear modelos'))
  modal.props.onClose();abort();await request;h.render();
  assert.equal(h.calls.find(c=>c[0]==='model-test')[1].signal.aborted,true)
  assert.equal(h.calls.some(c=>c[0]==='save'||c[0]==='setting'),false)
})
