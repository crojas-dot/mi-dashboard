import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { loadModule } from './load-module.mjs'
const target='00000000-0000-4000-8000-000000000002'
function fixture({current={id:'actor',auth_id:'auth-actor',rol:'admin'},failure=null}={}){
  const calls=[]
  const admin={auth:{admin:{createUser:async input=>{calls.push(['create',input]);return {data:{user:{id:'auth-new'}},error:null}},updateUserById:async(id,values)=>{calls.push(['auth-update',id,values]);return {error:null}},deleteUser:async()=>({error:null})}},from(table){
    calls.push(['from',table]);const q={select:()=>q,order:()=>q,eq:()=>q,or:value=>{calls.push(['or',value]);return q},abortSignal:()=>q,insert:payload=>{calls.push(['insert',payload]);return q},update:payload=>{calls.push(['profile-update',payload]);return q},maybeSingle:async()=>({data:{auth_id:'auth-target'},error:null}),then:resolve=>Promise.resolve({data:[],error:failure,count:2}).then(resolve)};return q
  }}
  const route=loadModule('app/api/usuarios/route.ts',{'next/server':{NextResponse:{json:(data,options={})=>new Response(JSON.stringify(data),options)}},'@/lib/server/auth':{getCurrentUser:async()=>current},'@/lib/server/supabase-admin':{createServiceClient:()=>admin},'@/lib/server/rateLimit':{rateLimit:()=>true,getClientIp:()=> 'fixture'},'@/lib/server/ultimoAcceso':{completarUltimoAcceso:async(_,rows)=>rows},'@/lib/utils/logger':{logger:{error(){}}}},{crypto:webcrypto})
  return {route,calls}
}
function request(method,body){return new Request('https://example.test/api/usuarios',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
test('datos inválidos se rechazan antes de cualquier efecto administrativo',async()=>{
  for(const [method,body]of [['POST',{nombre:45,email:'x@example.test',rol:'admin'}],['POST',{nombre:'X',email:'x@example.test',rol:'superadmin'}],['PATCH',{id:target,email:'nuevo@example.test',newPassword:'corto'}],['PATCH',{id:target,nombre:'  '}],['PATCH',{id:'not-uuid',nombre:'Nombre'}]]){
    const f=fixture();const result=await f.route[method](request(method,body));assert.equal(result.status,400);assert.equal(f.calls.length,0)
  }
})
test('email y contraseña validados se envían juntos en una única actualización Auth',async()=>{
  const f=fixture();const result=await f.route.PATCH(request('PATCH',{id:target,email:' Nuevo@Example.Test ',newPassword:' Mixed password9! '}));assert.equal(result.status,200)
  const updates=f.calls.filter(call=>call[0]==='auth-update');assert.equal(updates.length,1);assert.equal(updates[0][2].email,'nuevo@example.test');assert.equal(updates[0][2].password,' Mixed password9! ')
})
test('contraseña temporal API usa criptografía y conserva composición mínima',async()=>{
  const f=fixture();const result=await f.route.POST(request('POST',{nombre:' Nuevo ',email:'NEW@example.test',rol:'colaborador'}));assert.equal(result.status,201)
  const body=await result.json();assert.equal(body.tempPassword.length,16);assert.match(body.tempPassword,/[A-Z]/);assert.match(body.tempPassword,/[a-z]/);assert.match(body.tempPassword,/[0-9]/);assert.match(body.tempPassword,/[^A-Za-z0-9]/)
  assert.equal(f.calls.find(call=>call[0]==='create')[1].password,body.tempPassword)
})
test('búsqueda del API se mantiene dentro de dos condiciones literales y no filtra diagnósticos',async()=>{
  const f=fixture({failure:{code:'23505',message:'insert into usuarios secret=sk-fictitious-sensitive constraint hidden'}})
  const result=await f.route.GET(new Request('https://example.test/api/usuarios?search='+encodeURIComponent('a,b"),rol.eq.admin')))
  assert.equal(result.status,500);const message=await result.text();assert.equal(message.includes('sk-fictitious'),false);assert.equal(message.includes('constraint'),false)
  const filter=f.calls.find(call=>call[0]==='or')[1];assert.match(filter,/nombre\.ilike\."/);assert.match(filter,/,email\.ilike\."/);assert.equal(result.headers.get('cache-control'),'no-store')
})
test('un usuario sin administración no dispara efectos Auth ante un cuerpo válido',async()=>{
  const f=fixture({current:{id:'viewer',auth_id:'auth-viewer',rol:'calidad'}});const result=await f.route.POST(request('POST',{nombre:'X',email:'x@example.test',rol:'admin'}));assert.equal(result.status,403);assert.equal(f.calls.length,0)
})
