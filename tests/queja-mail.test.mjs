import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createHash,createHmac,randomUUID } from 'node:crypto'
import { loadModule } from './load-module.mjs'
const protocol=loadModule('lib/server/quejaMailProtocol.ts')
const worker=loadModule('lib/server/quejaMailWorker.ts')
const secret='fixture-only-'.repeat(4),config={secret,webAppUrl:'https://script.google.com/macros/s/fixture/exec'}
const message={eventId:randomUUID(),kind:'recibido',folio:'2026-001',to:'person@example.test',subject:'Queja recibida',body:'Folio ficticio'}
const envelope=()=>protocol.signMailEnvelope('delivery_request',message,secret)
function script(options={}){
 const rows=[['event_id','hash','status','started','confirmed']],sent=[]
 const range=(row,col,num=1,width=1)=>({getValues:()=>rows.slice(row-1,row-1+num).map(r=>r.slice(col-1,col-1+width)),setValue:v=>{rows[row-1][col-1]=v},createTextFinder:value=>({matchEntireCell(){return this},findNext(){const i=rows.findIndex((r,i)=>i>0&&r[0]===value);return i<0?null:{getRow:()=>i+1}}})})
 const sheet={getLastRow:()=>rows.length,getRange:range,appendRow:r=>rows.push(r)}
 const bytes=value=>Array.from(Buffer.isBuffer(value)?value:typeof value==='string'?Buffer.from(value):Buffer.from(value))
 const context={console:{info(){},warn(){}},Date,JSON,Number,Array,Object,
  Utilities:{Charset:{UTF_8:'UTF-8'},DigestAlgorithm:{SHA_256:'sha256'},getUuid:randomUUID,
   newBlob:v=>({getBytes:()=>bytes(v),getDataAsString:()=>Buffer.from(typeof v==='string'?v:v).toString()}),
   base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url'),base64DecodeWebSafe:v=>bytes(Buffer.from(v,'base64url')),
   computeHmacSha256Signature:(s,k)=>bytes(createHmac('sha256',k).update(s).digest()),computeDigest:(_a,s)=>bytes(createHash('sha256').update(s).digest())},
  PropertiesService:{getScriptProperties:()=>({getProperty:n=>({QMS_MAIL_SECRET:secret,QMS_MAIL_ENABLED:'true',QMS_MAIL_LEDGER_SPREADSHEET_ID:'fixture'}[n])})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType(){return s}})},
  LockService:{getScriptLock:()=>({tryLock:()=>options.lock!==false,releaseLock(){}})},
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},
  MailApp:{getRemainingDailyQuota:()=>options.quota??100,sendEmail:v=>{sent.push(v);if(options.throwSend)throw Error('synthetic provider failure')}}}
 vm.createContext(context);vm.runInContext(fs.readFileSync('integration/apps-script/quejas-mail/Codigo.gs','utf8'),context)
 const invoke=e=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(e)}}))
 return {context,rows,sent,invoke,receipt:e=>protocol.verifyMailEnvelope(e,'delivery_receipt',secret).payload}
}
test('protocolo verifica propósito, firma, ventana y payload sin aceptar campos extra',()=>{
 const e=envelope();assert.deepEqual(JSON.parse(JSON.stringify(protocol.verifyMailEnvelope(e,'delivery_request',secret).payload)),message)
 for(const altered of [{...e,purpose:'worker_request'},{...e,signature:'0'.repeat(64)},{...e,extra:true},{...e,issuedAt:e.issuedAt-301},{...e,payload:'='}])assert.throws(()=>protocol.verifyMailEnvelope(altered,'delivery_request',secret))
 assert.throws(()=>protocol.verifyMailEnvelope(e,'worker_request',secret));assert.throws(()=>protocol.verifyMailEnvelope(e,'delivery_request','wrong'))
})
test('Node y Apps Script interoperan y un replay no envía un segundo correo',()=>{
 const s=script(),e=envelope();assert.equal(s.receipt(s.invoke(e)).outcome,'sent');assert.equal(s.sent.length,1)
 assert.equal(s.receipt(s.invoke(e)).code,'already_sent');assert.equal(s.sent.length,1)
 assert.ok(!JSON.stringify(s.rows).includes(message.to)&&!JSON.stringify(s.rows).includes(message.body),'diario sin PII')
})
test('evento firmado con el mismo ID y distinto contenido se rechaza',()=>{
 const s=script();s.invoke(envelope());const e=protocol.signMailEnvelope('delivery_request',{...message,body:'Cambio'},secret)
 assert.equal(s.receipt(s.invoke(e)).code,'event_conflict');assert.equal(s.sent.length,1)
})
test('cuota agotada y lock ocupado son reintentos seguros antes de enviar',()=>{
 for(const options of [{quota:0},{lock:false}]) {const s=script(options);assert.equal(s.receipt(s.invoke(envelope())).outcome,'retry');assert.equal(s.sent.length,0);assert.equal(s.rows.length,1)}
})
test('error del proveedor conserva incertidumbre y bloquea el reenvío automático',()=>{
 const s=script({throwSend:true}),e=envelope();assert.equal(s.receipt(s.invoke(e)).outcome,'uncertain');assert.equal(s.receipt(s.invoke(e)).outcome,'uncertain');assert.equal(s.sent.length,1)
})
test('petición sin firma, otro propósito o lista de destinatarios no envía',()=>{
 const s=script();for(const e of [{},protocol.signMailEnvelope('worker_request',{},secret),{...envelope(),signature:'0'.repeat(64)}])assert.equal(s.invoke(e).error,'invalid_mail_request')
 const receipt=s.receipt(s.invoke(protocol.signMailEnvelope('delivery_request',{...message,to:'a@example.test,b@example.test'},secret)));assert.equal(receipt.outcome,'failed');assert.equal(s.sent.length,0)
})

test('delivery_request firmado no permite reactivar investigación ciudadana desde HTTP legacy', () => {
 const s = script()
 const retired = protocol.signMailEnvelope('delivery_request', { ...message, kind: 'investigacion' }, secret)
 const result = s.receipt(s.invoke(retired))
 assert.equal(result.outcome, 'failed')
 assert.equal(result.code, 'invalid_delivery')
 assert.equal(s.sent.length, 0)
 assert.equal(s.rows.length, 1)
})
function db(snapshot,ack=true){const calls=[];return {calls,rpc:async(n,args)=>{calls.push({n,args});return n==='qms_mail_claim_batch'?{data:snapshot,error:null}:{data:ack,error:null}}}}
const snapshot=()=>({id:randomUUID(),claim_token:randomUUID(),tipo:'final',destinatario:'person@example.test',folio:'2026-001',estado:'No Procede',numero_oficio:'ECA-GC-2026-001',notas:'SECRETO_INTERNO'})
test('worker envía solo snapshot público y confirma una respuesta firmada correlacionada',async()=>{
 const row=snapshot(),admin=db([row]);let posted
 const fetcher=async(url,opts)=>{assert.equal(url,config.webAppUrl);posted=protocol.verifyMailEnvelope(JSON.parse(opts.body),'delivery_request',secret);return Response.json(protocol.signMailEnvelope('delivery_receipt',{eventId:row.id,requestNonce:posted.envelope.nonce,outcome:'sent',code:'sent',retryAfterSeconds:300},secret))}
 const r=await worker.dispatchQuejaMail(admin,config,{limit:1,nonce:randomUUID(),issuedAt:Math.floor(Date.now()/1000)},{fetcher})
 assert.equal(r.sent,1);assert.ok(!JSON.stringify(posted.payload).includes(row.notas));assert.equal(admin.calls[1].args.p_outcome,'sent')
})
test('timeout o receipt falsificada causan incertidumbre sin reenvíos',async()=>{
 for(const fetcher of [async()=>{throw Error('network')},async()=>Response.json({})]) {const admin=db([snapshot()]);const result=await worker.dispatchQuejaMail(admin,config,{limit:1,nonce:randomUUID(),issuedAt:0},{fetcher});assert.equal(result.uncertain,1);assert.equal(admin.calls[1].args.p_outcome,'uncertain')}
})
test('ACK falso nunca se anuncia como envío confirmado',async()=>{
 const admin=db([snapshot()],false);await assert.rejects(()=>worker.dispatchQuejaMail(admin,config,{limit:1,nonce:randomUUID(),issuedAt:0},{fetcher:async()=>{throw Error()}}),/mail_ack_failed/)
})
test('redirección de Google recupera respuesta por GET y prohíbe repetir POST en otro host',async()=>{
 const row=snapshot(),admin=db([row]),calls=[];let e
 const fetcher=async(url,o)=>{calls.push({url,method:o.method});if(calls.length===1){e=JSON.parse(o.body);return new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/macros/echo?fixture=1'}})}return Response.json(protocol.signMailEnvelope('delivery_receipt',{eventId:row.id,requestNonce:e.nonce,outcome:'sent',code:'sent',retryAfterSeconds:300},secret))}
 assert.equal((await worker.dispatchQuejaMail(admin,config,{limit:1,nonce:randomUUID(),issuedAt:0},{fetcher})).sent,1);assert.equal(calls[1].method,'GET')
 const unsafe=db([snapshot()]);let n=0;await worker.dispatchQuejaMail(unsafe,config,{limit:1,nonce:randomUUID(),issuedAt:0},{fetcher:async()=>{n++;return new Response(null,{status:302,headers:{location:'https://evil.example/macros/echo'}})}});assert.equal(n,1);assert.equal(unsafe.calls[1].args.p_outcome,'uncertain')
})
test('endpoint rechaza autenticación o tamaño inválidos antes de service role',async()=>{
 let privileged=0
 const route=loadModule('app/api/quejas/correos/route.ts',{'next/server':{NextResponse:{json:Response.json}},'@/lib/server/quejaMailConfig':{quejaMailConfig:()=>config},'@/lib/server/supabase-admin':{createServiceClient(){privileged++;return null}}})
 for(const body of ['{}',JSON.stringify({...envelope(),purpose:'worker_request'}),' '.repeat(5000)]){const r=await route.POST(new Request('https://fixture/api/quejas/correos',{method:'POST',headers:{'content-type':'application/json'},body}));assert.ok([401,413].includes(r.status))}
 assert.equal(privileged,0)
})
test('proxy solo delega el POST exacto de correo a HMAC y limpia identidad inventada',async()=>{
 const proxy=loadModule('proxy.ts',{'next/server':{NextResponse:{next:opts=>({ok:true,headers:opts.request.headers}),json:Response.json}},'@/lib/server/auth':{getAuthToken:()=>null,getCurrentUser(){throw Error('unexpected identity lookup')}}},{Headers})
 const req=(p,m)=>({headers:new Headers({'x-user-id':'forged'}),method:m,nextUrl:{pathname:p}})
 const r=await proxy.proxy(req('/api/quejas/correos','POST'));assert.equal(r.ok,true);assert.equal(r.headers.has('x-user-id'),false)
 for(const [p,m]of [['/api/quejas/correos','GET'],['/api/quejas/correos/extra','POST'],['/api/usuarios','POST']])assert.equal((await proxy.proxy(req(p,m))).status,401)
})

test('correo HTML usa QMS ECA, azul de marca y escapa contenido sin recursos externos',()=>{
 const s=script(),e=protocol.signMailEnvelope('delivery_request',{...message,folio:'2026-001 <img src=x>',body:'Texto <script>alert(1)</script> & datos'},secret)
 s.invoke(e);assert.equal(s.sent[0].name,'QMS ECA');assert.match(s.sent[0].htmlBody,/#024796/);assert.match(s.sent[0].htmlBody,/&lt;script&gt;/);assert.doesNotMatch(s.sent[0].htmlBody,/<(script|img|iframe)\b/);assert.equal(s.sent[0].body,'Texto <script>alert(1)</script> & datos')
})

function ledgerInitializer(options = {}) {
 const properties = { QMS_MAIL_SECRET: secret, QMS_MAIL_ENABLED: 'false', ...options.properties }
 const books = new Map(), calls = []
 let locked = false, releases = 0, failInsert = options.failInsert === true
 function book(id, existingRows) {
  const sheets = new Map()
  function sheet(rows = []) {
   return { rows, frozen: 0, appendRow(row) { rows.push(row) }, setFrozenRows(count) { this.frozen = count } }
  }
  if (existingRows) sheets.set('_qms_mail_delivery', sheet(existingRows))
  const value = {
   sheets, getId: () => id, getSheetByName: name => sheets.get(name) ?? null,
   insertSheet(name) {
    assert.equal(locked, true)
    assert.ok(properties.QMS_MAIL_LEDGER_SPREADSHEET_ID, 'guardar ID antes de crear el diario')
    calls.push(['insert', name])
    if (failInsert) { failInsert = false; throw Error('synthetic insert failure') }
    assert.equal(sheets.has(name), false)
    const created = sheet(); sheets.set(name, created); return created
   },
  }
  books.set(id, value)
  return value
 }
 if (properties.QMS_MAIL_LEDGER_SPREADSHEET_ID) book(properties.QMS_MAIL_LEDGER_SPREADSHEET_ID, options.existingRows)
 const context = {
  Utilities: { newBlob: value => ({ getBytes: () => Array.from(Buffer.from(value)) }) },
  PropertiesService: { getScriptProperties() {
   calls.push(['properties'])
   return { getProperty: name => properties[name], setProperty(name, value) {
    assert.equal(locked, true); calls.push(['set', name]); properties[name] = value
   } }
  } },
  LockService: { getScriptLock: () => ({
   tryLock(milliseconds) {
    calls.push(['lock', milliseconds])
    if (options.lock === false || locked) return false
    locked = true; return true
   },
   releaseLock() { assert.equal(locked, true); locked = false; releases++ },
  }) },
  SpreadsheetApp: {
   create(name) {
    assert.equal(locked, true); calls.push(['create', name])
    options.onCreate?.(context)
    return book(`fixture-book-${books.size + 1}`)
   },
   openById(id) { assert.equal(locked, true); calls.push(['open', id]); return books.get(id) },
  },
  MailApp: { sendEmail() { assert.fail('inicializar nunca envía correo') } },
  ScriptApp: { newTrigger() { assert.fail('inicializar nunca instala triggers') } },
 }
 vm.createContext(context)
 vm.runInContext(fs.readFileSync('integration/apps-script/quejas-mail/Codigo.gs', 'utf8'), context)
 return { initialize: () => context.qmsMailInitializeLedger(), properties, books, calls, releases: () => releases }
}

test('inicializador crea y reutiliza un único libro/diario sin activar envíos', () => {
 const fixture = ledgerInitializer()
 fixture.initialize(); fixture.initialize()
 assert.equal(fixture.books.size, 1)
 assert.equal(fixture.calls.filter(([kind]) => kind === 'create').length, 1)
 assert.equal(fixture.calls.filter(([kind]) => kind === 'insert').length, 1)
 const sheet = fixture.books.get(fixture.properties.QMS_MAIL_LEDGER_SPREADSHEET_ID).sheets.get('_qms_mail_delivery')
 assert.deepEqual(JSON.parse(JSON.stringify(sheet.rows)), [['event_id', 'payload_sha256', 'delivery_status', 'started_at', 'confirmed_at']])
 assert.equal(sheet.frozen, 1)
 assert.equal(fixture.properties.QMS_MAIL_ENABLED, 'false')
 assert.equal(fixture.releases(), 2)
})

test('inicializador reutiliza el ID configurado y conserva las filas del diario', () => {
 const existingRows = [['header'], ['fixture-id', 'fixture-hash', 'sent', 'fixture-date', 'fixture-date']]
 const fixture = ledgerInitializer({ properties: { QMS_MAIL_LEDGER_SPREADSHEET_ID: 'fixture-existing' }, existingRows })
 fixture.initialize()
 assert.equal(fixture.properties.QMS_MAIL_LEDGER_SPREADSHEET_ID, 'fixture-existing')
 assert.equal(fixture.calls.filter(([kind]) => kind === 'create' || kind === 'insert' || kind === 'set').length, 0)
 assert.equal(fixture.books.get('fixture-existing').sheets.get('_qms_mail_delivery').rows, existingRows)
 assert.equal(existingRows.length, 2)
 assert.equal(fixture.releases(), 1)
})

test('inicializador agrega el diario faltante al libro existente, sin crear otro libro', () => {
 const fixture = ledgerInitializer({ properties: { QMS_MAIL_LEDGER_SPREADSHEET_ID: 'fixture-existing' } })
 fixture.initialize(); fixture.initialize()
 assert.equal(fixture.books.size, 1)
 assert.equal(fixture.calls.filter(([kind]) => kind === 'create').length, 0)
 assert.equal(fixture.calls.filter(([kind]) => kind === 'insert').length, 1)
})

test('inicializador con envío activo rechaza antes de tocar libros y libera el lock', () => {
 const fixture = ledgerInitializer({ properties: { QMS_MAIL_ENABLED: 'true' } })
 assert.throws(fixture.initialize, /mail_initialization_enabled/)
 assert.equal(fixture.calls.filter(([kind]) => ['create', 'open', 'insert', 'set'].includes(kind)).length, 0)
 assert.equal(fixture.releases(), 1)
})

test('inicializador rechaza lock ocupado antes de leer propiedades o crear libros', () => {
 const fixture = ledgerInitializer({ lock: false })
 assert.throws(fixture.initialize, /ledger_busy/)
 assert.deepEqual(fixture.calls, [['lock', 3000]])
 assert.equal(fixture.releases(), 0)
})

test('inicializador no duplica libros si una ejecución falla tras guardar su ID', () => {
 const fixture = ledgerInitializer({ failInsert: true })
 assert.throws(fixture.initialize, /synthetic insert failure/)
 assert.ok(fixture.properties.QMS_MAIL_LEDGER_SPREADSHEET_ID)
 fixture.initialize()
 assert.equal(fixture.books.size, 1)
 assert.equal(fixture.calls.filter(([kind]) => kind === 'create').length, 1)
 assert.equal(fixture.books.get(fixture.properties.QMS_MAIL_LEDGER_SPREADSHEET_ID).sheets.size, 1)
 assert.equal(fixture.releases(), 2)
})

test('ScriptLock impide otra inicialización simultánea y se libera al concluir', () => {
 const fixture = ledgerInitializer({ onCreate: context => assert.throws(() => context.qmsMailInitializeLedger(), /ledger_busy/) })
 fixture.initialize(); fixture.initialize()
 assert.equal(fixture.books.size, 1)
 assert.equal(fixture.calls.filter(([kind]) => kind === 'create').length, 1)
 assert.equal(fixture.releases(), 2)
})
