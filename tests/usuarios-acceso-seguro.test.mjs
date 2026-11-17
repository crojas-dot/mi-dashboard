import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {loadModule} from './load-module.mjs'
import {createClient} from '@supabase/supabase-js'

const actor={id:randomUUID(),sessionId:randomUUID(),aal:'aal1',token:'synthetic-bearer'}
const target=randomUUID(),origin='https://qms.example.test'
const environment={env:{PUBLIC_TRACKING_ORIGIN:origin,NEXT_PUBLIC_SUPABASE_URL:'https://auth.example.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-key',NODE_ENV:'production'}}
const request=(path,body,headers={})=>new Request(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(body)})
const responseMock={'next/server':{NextResponse:{json:(value,options)=>Response.json(value,options)}}}
const guards={'@/lib/server/rateLimit':{rateLimit:()=>true,getClientIp:()=> 'fixture'}}
const service=()=>loadModule('lib/server/accessService.ts',{}, {process:environment})

test('SDK real transporta el Bearer de la persona en enrolamiento, desafío y validación TOTP',async()=>{
 const calls=[],factor=randomUUID(),native=randomUUID()
 const jwt=aal=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:actor.id,session_id:actor.sessionId,aal,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.c3ludGhldGlj'
 const token=jwt('aal1')
 const api=loadModule('lib/server/accessIdentity.ts',{'@supabase/supabase-js':{createClient:(url,key,options)=>createClient(url,key,{...options,global:{...options.global,fetch:async(input,init)=>{
  const url=String(input),path=new URL(url).pathname;calls.push(path)
  assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+token)
  if(path.endsWith('/user'))return Response.json({id:actor.id,email:'synthetic@example.test',factors:[]})
  if(path.endsWith('/factors'))return Response.json({id:factor,type:'totp',totp:{qr_code:'<svg/>',secret:'SYNTHETIC'}})
  if(path.endsWith('/challenge'))return Response.json({id:native,expires_at:Math.floor(Date.now()/1000)+600,type:'totp'})
  if(path.endsWith('/verify'))return Response.json({access_token:jwt('aal2'),refresh_token:'synthetic',expires_in:3600,token_type:'bearer',user:{id:actor.id}})
  assert.fail('Unexpected endpoint '+path)
 }}})},'@/lib/server/auth':{getAuthToken:req=>req.headers.get('authorization')?.slice(7)}},{process:environment})
 const identity=await api.getAccessIdentity(new Request(origin,{headers:{Authorization:'Bearer '+token}}))
 assert.equal(identity.sessionId,actor.sessionId)
 const enrolled=await identity.client.auth.mfa.enroll({factorType:'totp',issuer:'ECA-QMS'})
 assert.equal(enrolled.error,null);assert.match(enrolled.data.totp.qr_code,/data:image\/svg/)
 const challenge=await identity.client.auth.mfa.challenge({factorId:factor});assert.equal(challenge.error,null)
 const verified=await identity.client.auth.mfa.verify({factorId:factor,challengeId:native,code:'123456'});assert.equal(verified.error,null)
 assert.equal(calls.filter(path=>path.endsWith('/verify')).length,1)
})

test('alta reserva antes de Auth, crea una sola cuenta y conserva perfil ante fallo de correo',async()=>{
 const calls=[],setup={id:randomUUID(),invite:true,requireMfa:true}
 const admin={rpc:async(action,args)=>{
  calls.push(args.p_action)
  if(args.p_action==='create_begin')return {data:{completed:false,authId:null}}
  if(args.p_action==='invite')return {data:{email:'new@example.test'}}
  return {data:{}}
 },auth:{admin:{createUser:async input=>{calls.push('auth');assert.equal(input.app_metadata.qms_creation_id,setup.id);assert.equal(input.password.length,24);return {data:{user:{id:target}}}},deleteUser:()=>assert.fail('No eliminar una cuenta ya creada')}},functions:{invoke:async()=>({error:new Error('synthetic delivery failure')})}}
 const value=await service().createUserWithAccess(admin,actor,{nombre:'Persona ficticia',email:'new@example.test',rol:'colaborador',estado:'activo'},setup)
 assert.deepEqual(calls,['create_begin','auth','create_commit','invite','invite_result'])
 assert.equal(value.created,true);assert.equal(value.userId,target);assert.equal(value.invitation,'failed');assert.equal(value.tempPassword,undefined)
})
test('reintento de alta completada no crea Auth, no reenvía correo ni vuelve a revelar contraseña',async()=>{
 const admin={rpc:async()=>({data:{completed:true,authId:target}}),auth:{admin:{createUser:()=>assert.fail('Duplicado')}},functions:{invoke:()=>assert.fail('Reenvío automático')}}
 const value=await service().createUserWithAccess(admin,actor,{nombre:'X',email:'x@example.test',rol:'colaborador',estado:'activo'},{id:randomUUID(),invite:false,requireMfa:false})
 assert.equal(value.tempPassword,undefined);assert.equal(value.created,true)
})
test('sin invitación, la contraseña se genera en servidor y solo sale en la primera respuesta',async()=>{
 let password
 const admin={rpc:async(_,{p_action})=>({data:p_action==='create_begin'?{completed:false,authId:null}:{}}),auth:{admin:{createUser:async value=>{password=value.password;return {data:{user:{id:target}}}}}},functions:{invoke:()=>assert.fail('No enviar correo')}}
 const result=await service().createUserWithAccess(admin,actor,{nombre:'X',email:'x@example.test',rol:'colaborador',estado:'activo'},{id:randomUUID(),invite:false,requireMfa:true})
 assert.equal(result.tempPassword,password);assert.match(password,/[A-Z]/);assert.match(password,/[0-9]/);assert.equal(password.length,24)
})
test('localhost se elige únicamente en desarrollo; producción conserva HTTPS aunque cambie el Host',async()=>{
 for(const mode of ['development','production']) {
  let sent
  const s=loadModule('lib/server/accessService.ts',{}, {process:{env:{...environment.env,NODE_ENV:mode}}})
  const admin={rpc:async(_,{p_action})=>({data:p_action==='invite'?{email:'new@example.test'}:{}}),functions:{invoke:async(_,input)=>{sent=input.body;return {data:{outcome:'sent'}}}}}
  await s.inviteAccess(admin,actor,target,'http://localhost:3000')
  assert.equal(sent.url.startsWith(mode==='development'?'http://localhost:3000/':origin+'/'),true)
  assert.equal(sent.local,mode==='development'?true:undefined)
 }
})
test('un conflicto de reserva no dispara efectos Auth y un RPC caído nunca se interpreta como usuario antiguo',async()=>{
 const s=service(),identity=actor
 const denied={rpc:async()=>({error:{code:'40001'}}),auth:{admin:{createUser:()=>assert.fail('No reservar Auth')}}}
 await assert.rejects(s.createUserWithAccess(denied,identity,{email:'x@example.test'},{invite:false}),e=>e.status===409)
 const failed={rpc:async()=>({error:{code:'08006'}}),from:()=>assert.fail('No fallback ante fallo de DB')}
 await assert.rejects(s.accessStatus(failed,identity))
})
test('cambio obligatorio usa el token propio, sin reset administrativo ni revocación accidental de la sesión',async()=>{
 let call
 const s=loadModule('lib/server/accessService.ts',{}, {process:environment,fetch:async(url,options)=>{call={url,options};return Response.json({id:actor.id})}})
 await s.setOwnAccessPassword(actor,'New synthetic password 8!')
 assert.equal(call.url,'https://auth.example.test/auth/v1/user');assert.equal(call.options.method,'PUT');assert.equal(call.options.headers.Authorization,'Bearer '+actor.token)
 assert.deepEqual(JSON.parse(call.options.body),{password:'New synthetic password 8!'})
})
test('lectura JSON limita bytes reales, incluso sin Content-Length',async()=>{
 const {readAccessJson}=service()
 for(const body of ['[]','null','"value"','{"extra":"'+'a'.repeat(5000)+'"}']){
  await assert.rejects(readAccessJson(new Request(origin,{method:'POST',headers:{'Content-Type':'application/json'},body})),e=>e.status===400)
 }
})

function accessApi({identity=actor,phase='enroll',command=async()=>({phase:'ready'}),mail='sent',native={}}={}) {
 const calls=[],s=service()
 const id=identity?{...identity,client:{auth:{mfa:native,getClaims:async()=>({data:{claims:{sub:identity.id,session_id:identity.sessionId,aal:'aal2'}}})}}}:null
 const api=loadModule('app/api/auth/acceso/route.ts',{
  ...responseMock,...guards,'@/lib/server/accessIdentity':{getAccessIdentity:async()=>id},'@/lib/server/supabase-admin':{createServiceClient:()=>({})},
  '@/lib/server/accessService':{...s,accessStatus:async()=>({managed:true,phase}),accessCommand:async(_,who,action,payload)=>{calls.push({who,action,payload});return command(action,payload)},sendAccessMessage:async(_,message)=>{calls.push({mail:message});return mail},setOwnAccessPassword:async()=>calls.push({password:true})},
 })
 return {api,calls}
}
test('acceso rechaza Bearer inválido y cuenta bloqueada antes de cualquier mutación',async()=>{
 for(const [options,status]of [[{identity:null},401],[{phase:'blocked'},403]]){
  const f=accessApi(options)
  assert.equal((await f.api.POST(request('/api/auth/acceso',{action:'email_send',email:'alt@example.test'}))).status,status)
  assert.equal(f.calls.length,0)
 }
})
test('contraseña precede al segundo factor y el código enviado nunca vuelve al navegador',async()=>{
 let f=accessApi({phase:'password'})
 assert.equal((await f.api.POST(request('/api/auth/acceso',{action:'email_send',email:'alt@example.test'}))).status,403);assert.equal(f.calls.length,0)
 f=accessApi({command:async()=>({id:target,code:'123456',email:'alt@example.test',maskedEmail:'alt***@example.test'})})
 const result=await f.api.POST(request('/api/auth/acceso',{action:'email_send',email:'alt@example.test'}))
 assert.equal(result.status,200);assert.doesNotMatch(await result.text(),/123456|"email"/)
 assert.deepEqual(f.calls.filter(c=>c.action).map(c=>c.action),['email_send','email_sent'])
 assert.equal(f.calls.at(-1).payload.sent,true)
})
test('envío incierto no habilita el desafío; datos de identidad y AAL del navegador se rechazan',async()=>{
 const f=accessApi({mail:'uncertain',command:async()=>({id:target,code:'123456',email:'alt@example.test'})})
 assert.equal((await f.api.POST(request('/api/auth/acceso',{action:'email_send',email:'alt@example.test'}))).status,503)
 assert.equal(f.calls.at(-1).payload.sent,false)
 const invalid=accessApi()
 assert.equal((await invalid.api.POST(request('/api/auth/acceso',{action:'email_verify',id:target,code:'123456',aal:'aal2',user:actor.id}))).status,400);assert.equal(invalid.calls.length,0)
})
test('TOTP valida con Auth y confirma prueba para la misma sesión con AAL2 real',async()=>{
 const native={verify:async args=>{assert.equal(args.code,'123456');return {data:{access_token:'synthetic-access',refresh_token:'synthetic-refresh'}}}}
 const f=accessApi({phase:'verify',native,command:async action=>action==='totp_attempt'?{factorId:target,nativeId:target,lease:target}:{phase:'ready'}})
 const result=await f.api.POST(request('/api/auth/acceso',{action:'totp_verify',id:target,code:'123456'}))
 assert.equal(result.status,200);assert.equal(f.calls.at(-1).action,'totp_finish');assert.equal(f.calls.at(-1).who.aal,'aal2')
 const bad=accessApi({phase:'verify',native:{verify:async()=>({error:{message:'Auth private diagnostic'}})},command:async()=>({factorId:target,nativeId:target,lease:target})})
 const failed=await bad.api.POST(request('/api/auth/acceso',{action:'totp_verify',id:target,code:'000000'}))
 assert.equal(failed.status,400);assert.doesNotMatch(await failed.text(),/private|diagnostic/);assert.equal(bad.calls.at(-1).payload.valid,false)
})

function adminApi({current={rol:'admin'},identity=actor,deleteFailure=false}={}) {
 const calls=[],s=service()
 const admin={auth:{admin:{mfa:{listFactors:async()=>{calls.push('list');return {data:{factors:[{id:target}]}}},deleteFactor:async()=>{calls.push('delete');return {error:deleteFailure?{}:null}}}}}}
 const api=loadModule('app/api/usuarios/acceso/route.ts',{...responseMock,...guards,
  '@/lib/server/auth':{getCurrentUser:async()=>current},'@/lib/server/accessIdentity':{getAccessIdentity:async()=>identity},'@/lib/server/supabase-admin':{createServiceClient:()=>admin},
  '@/lib/server/accessService':{...s,accessCommand:async(_,who,action)=>{calls.push(action);assert.equal(who.id,actor.id);return {}},inviteAccess:async()=>{calls.push('invite');return 'sent'}},
 })
 return {api,calls}
}
test('restablecer 2FA exige administrador real, confirmación y otro usuario',async()=>{
 for(const [options,body,status]of [[{current:null},{},401],[{current:{rol:'calidad'}},{},403],[{}, {authId:target,action:'reset_mfa'},400],[{}, {authId:actor.id,action:'reset_mfa',confirm:true},400]]){
  const f=adminApi(options);assert.equal((await f.api.POST(request('/api/usuarios/acceso',body))).status,status);assert.equal(f.calls.length,0)
 }
})
test('reset cierra acceso antes de borrar factores; un fallo conserva el bloqueo',async()=>{
 for(const failed of [false,true]) {
  const f=adminApi({deleteFailure:failed})
  const result=await f.api.POST(request('/api/usuarios/acceso',{authId:target,action:'reset_mfa',confirm:true}))
  assert.equal(result.status,failed?503:200);assert.deepEqual(f.calls,failed?['reset_begin','list','delete']:['reset_begin','list','delete','reset_finish'])
 }
})

test('canje de invitación exige origen correcto y usa recovery de cuenta existente, nunca alta ni envío nativo',async()=>{
 const calls=[],token='t'.repeat(43)
 const admin={rpc:async(_,payload)=>{calls.push('redeem');assert.match(payload.p_digest,/^[a-f0-9]{64}$/);return {data:{email:'new@example.test',authId:target}}},auth:{admin:{generateLink:async input=>{calls.push(input.type);return {data:{user:{id:target},properties:{hashed_token:'synthetic-hash'}}}}}}}
 const api=loadModule('app/api/public/acceso/invitacion/route.ts',{...responseMock,...guards,'@/lib/server/supabase-admin':{createServiceClient:()=>admin},'@supabase/supabase-js':{createClient:()=>({auth:{verifyOtp:async input=>{calls.push(input.type);return {data:{user:{id:target},session:{access_token:'synthetic',refresh_token:'synthetic-refresh'}}}}}})}},{process:environment})
 assert.equal((await api.POST(request('/api/public/acceso/invitacion',{token},{Origin:'https://attacker.example.test'}))).status,403)
 assert.equal(calls.length,0)
 const result=await api.POST(request('/api/public/acceso/invitacion',{token}));assert.equal(result.status,200)
 assert.deepEqual(calls,['redeem','recovery','recovery']);assert.equal(result.headers.get('cache-control'),'no-store')
})
