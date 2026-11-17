import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {loadModule,fakeDatabase} from './load-module.mjs'
const actor=randomUUID(),target=randomUUID(),native=randomUUID(),job=randomUUID()
const {eliminarCuentaUsuario}=loadModule('lib/server/usuarioDeletion.ts')
function fixture({authId=native,completed=false,providerError=false,absent=false,finishError=null,beginError=null}={}) {
 const calls=[]
 const admin={rpc:async(name,args)=>{
  assert.equal(name,'qms_delete_user_account');assert.equal(args.p_actor_auth,actor);assert.equal(args.p_target,target)
  calls.push(args.p_phase)
  if(args.p_phase==='begin')return {data:{completed,requestId:job,authId},error:beginError}
  assert.equal(args.p_request,job);return {data:{completed:true},error:finishError}
 },auth:{admin:{deleteUser:async id=>{assert.equal(id,native);calls.push('auth');return {error:providerError?{code:'unexpected_failure'}:null}},getUserById:async id=>{assert.equal(id,native);calls.push('confirm');return absent?{error:{code:'user_not_found'}}:{data:{user:{id:native}},error:null}}}},from:()=>assert.fail('No borrar perfiles ni relaciones desde el servicio')}
 return {admin,calls}
}
test('borrado suspende primero, elimina Auth y confirma sin borrar perfil QMS',async()=>{
 const f=fixture();await eliminarCuentaUsuario(f.admin,actor,target)
 assert.deepEqual(f.calls,['begin','auth','finish'])
})
test('recupera el perfil cuyo Auth ya fue borrado, sin enviar deleteUser(null)',async()=>{
 const f=fixture({authId:null});await eliminarCuentaUsuario(f.admin,actor,target)
 assert.deepEqual(f.calls,['begin','finish'])
 const done=fixture({completed:true});await eliminarCuentaUsuario(done.admin,actor,target);assert.deepEqual(done.calls,['begin'])
})
test('un error o timeout de Auth solo se da por borrado cuando se confirma ausencia por ID',async()=>{
 const pending=fixture({providerError:true})
 await assert.rejects(eliminarCuentaUsuario(pending.admin,actor,target),e=>e.status===409&&/desactivada/.test(e.message))
 assert.deepEqual(pending.calls,['begin','auth','confirm'])
 const recovered=fixture({providerError:true,absent:true});await eliminarCuentaUsuario(recovered.admin,actor,target)
 assert.deepEqual(recovered.calls,['begin','auth','confirm','finish'])
})
test('permisos, conflictos y DB fallida se rechazan sin ejecutar más efectos',async()=>{
 for(const [error,status]of [[{code:'42501'},403],[{code:'40001'},409],[{code:'P0002'},404],[{code:'08006',message:'secret diagnostic'},503]]) {
  const f=fixture({beginError:error})
  await assert.rejects(eliminarCuentaUsuario(f.admin,actor,target),e=>e.status===status&&!e.message.includes('secret'))
  assert.deepEqual(f.calls,['begin'])
 }
 const f=fixture({finishError:{code:'40001'}})
 await assert.rejects(eliminarCuentaUsuario(f.admin,actor,target),e=>e.status===409)
 assert.deepEqual(f.calls,['begin','auth','finish'])
})
test('API DELETE valida Bearer, rol e ID antes de crear el cliente privilegiado',async()=>{
 for(const [current,id,status]of [[null,target,401],[{rol:'calidad'},target,403],[{rol:'admin'},'invalid',400]]) {
  const route=loadModule('app/api/usuarios/route.ts',{
   '@/lib/server/auth':{getCurrentUser:async()=>current},'@/lib/server/rateLimit':{rateLimit:()=>true,getClientIp:()=> 'fixture'},
   '@/lib/server/supabase-admin':{createServiceClient:()=>assert.fail('No acceder sin permisos')},
  })
  const result=await route.DELETE(new Request('https://example.test/api/usuarios',{method:'DELETE',body:JSON.stringify({id})}))
  assert.equal(result.status,status)
 }
})
test('API DELETE recupera el mismo perfil huérfano y comunica fallos parciales sin diagnóstico remoto',async()=>{
 for(const pending of [false,true]){
  const f=fixture({authId:pending?native:null,providerError:pending})
  const route=loadModule('app/api/usuarios/route.ts',{
   '@/lib/server/auth':{getCurrentUser:async()=>({id:randomUUID(),auth_id:actor,rol:'admin'})},
   '@/lib/server/rateLimit':{rateLimit:()=>true,getClientIp:()=> 'fixture'},
   '@/lib/server/supabase-admin':{createServiceClient:()=>f.admin},
  })
  const response=await route.DELETE(new Request('https://example.test/api/usuarios',{method:'DELETE',body:JSON.stringify({id:target})}))
  assert.equal(response.status,pending?409:200)
  const result=await response.json();assert.equal(response.headers.get('cache-control'),'no-store')
  if(pending)assert.match(result.error,/desactivada/);else assert.equal(result.ok,true)
 }
})
test('el directorio excluye retirados y conserva inactivos normales',async()=>{
 const db=fakeDatabase({usuarios:[{id:'active',estado:'activo'},{id:'inactive',estado:'inactivo'},{id:'retired',estado:'inactivo',eliminado_en:'2026-11-17'}]})
 const route=loadModule('app/api/usuarios/route.ts',{
  '@/lib/server/auth':{getCurrentUser:async()=>({rol:'calidad'})},'@/lib/server/rateLimit':{rateLimit:()=>true,getClientIp:()=> 'fixture'},
  '@/lib/server/supabase-admin':{createServiceClient:()=>db.supabase},'@/lib/server/ultimoAcceso':{completarUltimoAcceso:async(_,rows)=>rows},
 })
 const result=await route.GET(new Request('https://example.test/api/usuarios'))
 assert.equal(result.status,200);assert.deepEqual((await result.json()).map(u=>u.id),['active','inactive'])
})
