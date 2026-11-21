import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createHmac,createHash,randomUUID,webcrypto} from 'node:crypto'
import {loadModule} from './load-module.mjs'

const secret='synthetic-access-mail-key-'.repeat(3),machine='synthetic-service-role',origin='https://qms.example.test'
function fixture(options={}) {
 const sent=[],requests=[],cache=new Map(),logs=[]
 const brand='https://synthetic.supabase.co/storage/v1/object/public/branding/identidad/correo_encabezado/11111111-1111-4111-8111-111111111111.png'
 const properties={QMS_MAIL_SECRET:secret,QMS_MAIL_ENABLED:'true',QMS_PUBLIC_TRACKING_ORIGIN:origin,QMS_MAIL_QUEUE_URL:'https://synthetic.supabase.co/functions/v1/quejas-mail-queue'}
 const bytes=value=>Array.from(Buffer.from(value))
 const context=vm.createContext({Date,JSON,Number,Array,Object,
  console:{warn:(...args)=>logs.push(args),info:(...args)=>logs.push(args)},
  PropertiesService:{getScriptProperties:()=>({getProperty:name=>properties[name]})},
  Utilities:{Charset:{UTF_8:'UTF-8'},getUuid:randomUUID,newBlob:value=>({getBytes:()=>bytes(value),getDataAsString:()=>Buffer.from(value).toString('utf8')}),
   base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url'),base64DecodeWebSafe:value=>bytes(Buffer.from(value,'base64url')),
   computeHmacSha256Signature:(value,key)=>bytes(createHmac('sha256',key).update(value).digest()),computeDigest:(_,value)=>bytes(createHash('sha256').update(value).digest())},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value)})},
  MailApp:{getRemainingDailyQuota:()=>options.quota??100,sendEmail:mail=>{sent.push(mail);if(options.uncertain)throw new Error('synthetic mail failure')}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({setMimeType:()=>text})},
 })
 vm.runInContext(fs.readFileSync('integration/apps-script/quejas-mail/Codigo.gs','utf8')+'\n'+fs.readFileSync('integration/apps-script/quejas-mail/Acceso.gs','utf8'),context)
 const env={SUPABASE_SERVICE_ROLE_KEY:machine,QUEJAS_MAIL_SIGNING_SECRET:secret,PUBLIC_TRACKING_ORIGIN:origin,SUPABASE_URL:'https://synthetic.supabase.co'}
 const api=loadModule('supabase/functions/qms-access-mailer/index.ts').createAccessMailer({env:name=>env[name],crypto:webcrypto,fetcher:async(url,settings)=>{
  requests.push(url)
  if(url.includes('/rest/v1/configuraciones_sistema')) {
    return options.noLogo ? Response.json([]) : Response.json([{clave:'org.identidad.correo_encabezado',valor:options.brand ?? brand}])
  }
  if(url.endsWith('qms_access_mail_transport')){
   if(settings.headers.apikey!==(options.machine??machine))return Response.json({error:'denied'},{status:401})
   return Response.json({enabled:true,endpoint:options.endpoint??'https://script.google.com/macros/s/synthetic/exec'})
  }
  const output=context.doPost({postData:{contents:settings.body}})
  if(options.rejectBeforeMail)return Response.json({error:'invalid_access_delivery'})
  if(options.forge){const parsed=JSON.parse(output);parsed.signature='0'.repeat(64);return Response.json(parsed)}
  return new Response(output)
 }})
 const send=(message,key=machine)=>api(new Request(origin,{method:'POST',headers:{Authorization:'Bearer '+key},body:JSON.stringify(message)}))
 return {send,sent,requests,cache,logs,context,api,brand}
}
const invitation=()=>({eventId:randomUUID(),kind:'invitation',to:'synthetic@example.test',url:origin+'/acceso#invitacion='+'a'.repeat(43)})
test('Edge → Apps Script usa HMAC por propósito y confirma invitación sin contraseña',async()=>{
 const f=fixture(),message=invitation()
 assert.equal((await f.send(message)).status,200);assert.equal(f.sent.length,1)
 assert.match(f.sent[0].body,/24 horas/);assert.match(f.sent[0].htmlBody,/#024796/);assert.doesNotMatch(f.sent[0].body,/password:/i)
 assert.match(f.sent[0].htmlBody,/max-width:900px/)
 assert.match(f.sent[0].htmlBody,/<h1[^>]+font-family:Inter,Roboto,Segoe UI,Arial,sans-serif/)
 assert.match(f.sent[0].htmlBody,/font-family:Inter,Roboto,Segoe UI,Arial,sans-serif;font-size:16px/)
 assert.match(f.sent[0].htmlBody,/Invitación de usuario/)
 assert.match(f.sent[0].htmlBody,/border-bottom:1px solid #dee2e6/)
 assert.ok(f.sent[0].htmlBody.includes('<img src="'+f.brand+'"'))
 assert.match(f.sent[0].htmlBody,/width="200" height="64"/)
 assert.equal(f.logs.length,0);assert.equal(f.requests.length,3)
 // El recibo idéntico no repite MailApp aunque Edge reenvíe con otro nonce.
 assert.equal((await f.send(message)).status,200);assert.equal(f.sent.length,1)
 assert.doesNotMatch(JSON.stringify([...f.cache.values()]),/synthetic@example|invitacion=|123456/)
})
test('la identidad sin logo o con URL no confiable conserva el logo institucional incluido',async()=>{
 for(const options of [{noLogo:true},{brand:'https://attacker.example.test/logo.png'}]){
  const f=fixture(options)
  const response=await f.send(invitation())
  assert.equal(response.status,200)
  assert.equal(f.sent.length,1)
  assert.ok(f.sent[0].htmlBody.includes(`${origin}/logo-email-horizontal.png`))
  assert.doesNotMatch(f.sent[0].htmlBody,/attacker\.example/)
  assert.match(f.sent[0].htmlBody,/QMS ECA · Gestión de Calidad/)
 }
})

test('Google Apps Script rechaza el mensaje antes de MailApp con diagnóstico explícito, sin reintento ciego',async()=>{
 const f=fixture({rejectBeforeMail:true})
 const r=await f.send({eventId:randomUUID(),kind:'temporary_access',to:'synthetic@example.test',name:'Usuario sintético',password:'Test!SyntheticPassword123456',url:origin+'/login'})
 assert.equal(r.status,503)
 assert.deepEqual(await r.json(),{outcome:'failed',code:'provider_rejected'})
 assert.equal(f.sent.length,0)
})

test('la contraseña temporal se entrega en un único correo con enlace al login y vigencia de 72 horas',async()=>{
 const f=fixture(),eventId=randomUUID(),message={eventId,kind:'temporary_access',to:'synthetic@example.test',
  name:'Usuario de prueba',password:'A9!synthetic-password-2026',url:origin+'/login'}
 const response=await f.send(message)
 assert.equal(response.status,200)
 assert.equal((await response.json()).outcome,'sent')
 assert.equal(f.sent.length,1)
 assert.match(f.sent[0].body,/Usuario: synthetic@example\\.test/)
 assert.match(f.sent[0].body,/Contraseña temporal:/)
 assert.match(f.sent[0].body,/72 horas/)
 assert.match(f.sent[0].body,/cambiarla/)
 assert.match(f.sent[0].htmlBody,/Iniciar sesión/)
  assert.ok(f.sent[0].htmlBody.includes('>Usuario</td>'))
  assert.ok(f.sent[0].htmlBody.includes('>Contraseña temporal</td>'))
  assert.doesNotMatch(f.sent[0].htmlBody,/Configurar acceso/)
 assert.equal((await (await f.send(message)).json()).outcome,'sent')
 assert.equal(f.sent.length,1)
 assert.doesNotMatch(JSON.stringify([...f.cache.values()]),/synthetic@example|synthetic-password/)
})

test('la cuota de acceso agotada devuelve el diagnóstico previo a MailApp', async () => {
 const f=fixture({quota:0})
 assert.deepEqual(await (await f.send(invitation())).json(), {outcome:'failed',code:'quota_exhausted'})
 assert.equal(f.sent.length,0)
 assert.equal(f.cache.size,0)
})
test('OTP es distinto del correo de invitación y el diario temporal no almacena sus seis dígitos',async()=>{
 const f=fixture();const result=await f.send({eventId:randomUUID(),kind:'email_otp',to:'alt@example.test',code:'123456'})
 assert.equal((await result.json()).outcome,'sent');assert.match(f.sent[0].body,/123456/);assert.match(f.sent[0].body,/10 minutos/)
 assert.doesNotMatch(JSON.stringify([...f.cache.values()]),/123456|alt@example/)
})
test('invitación local firmada solo admite loopback y avisa que abre la misma computadora',async()=>{
 const f=fixture(),message={...invitation(),local:true,url:'http://localhost:3000/acceso#invitacion='+'a'.repeat(43)}
 assert.equal((await f.send(message)).status,200);assert.equal(f.sent.length,1)
 assert.match(f.sent[0].body,/misma computadora/);assert.match(f.sent[0].htmlBody,/localhost:3000/)
 for(const url of ['http://attacker.example.test:3000/acceso','http://localhost:4000/acceso','http://localhost.attacker.test:3000/acceso','https://localhost:3000/acceso']){
  assert.equal((await f.send({...message,eventId:randomUUID(),url:url+'#invitacion='+'a'.repeat(43)})).status,503)
 }
 assert.equal(f.sent.length,1)
 assert.equal((await f.send({...message,eventId:randomUUID(),local:false})).status,503)
})
test('no envía con clave incorrecta, destino externo, campos extra ni configuración de transporte arbitraria',async()=>{
 const f=fixture()
 assert.equal((await f.send(invitation(),'synthetic-anon')).status,401);assert.equal(f.requests.length,1)
 assert.equal((await f.send({...invitation(),url:'https://attacker.example.test/acceso#invitacion='+'a'.repeat(43)})).status,503)
 assert.equal((await f.send({...invitation(),password:'never-send-this'})).status,503);assert.equal(f.sent.length,0)
 const bad=fixture({endpoint:'https://attacker.example.test/collect'})
 assert.equal((await bad.send(invitation())).status,503);assert.equal(bad.requests.length,1)
})

test('la credencial de máquina se verifica por RPC service-only, compatible con JWT anterior y clave nueva',async()=>{
 const previous=fixture({machine:'synthetic-previous-service-key'})
 assert.equal((await previous.send(invitation(),'synthetic-previous-service-key')).status,200)
 assert.equal(previous.sent.length,1)
 const modern=fixture({machine:'sb_secret_synthetic-current-service-key'})
 assert.equal((await modern.api(new Request(origin,{method:'POST',headers:{apikey:'sb_secret_synthetic-current-service-key'},body:JSON.stringify(invitation())}))).status,200)
 assert.equal(modern.sent.length,1)
 const forged=Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')
 assert.equal((await modern.send(invitation(),'unsigned.'+forged+'.unsigned')).status,401)
 assert.equal((await modern.send(invitation(),'synthetic-user-session')).status,401)
 assert.equal(modern.sent.length,1)
})
test('recibo adulterado o resultado incierto no se confirman como enviados ni provocan reintento automático',async()=>{
 for(const option of [{forge:true},{uncertain:true}]){
  const f=fixture(option),message=invitation(),response=await f.send(message)
  assert.equal((await response.json()).outcome,'uncertain');assert.equal(f.sent.length,1)
  await f.send(message);assert.equal(f.sent.length,1)
 }
})
