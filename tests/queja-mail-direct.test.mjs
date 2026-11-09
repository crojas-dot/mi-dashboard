import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createHash, createHmac, randomUUID, webcrypto } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const source = fs.readFileSync('integration/apps-script/quejas-mail/Codigo.gs', 'utf8')

test('activar el correo directo nunca reactiva el worker retirado de Vercel', () => {
  const { quejaMailConfig } = loadModule('lib/server/quejaMailConfig.ts')
  const environment = { QUEJAS_MAIL_ENABLED: 'true', QUEJAS_MAIL_SIGNING_SECRET: 'synthetic-only-'.repeat(4),
    QUEJAS_MAIL_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/synthetic/exec' }
  assert.equal(quejaMailConfig(environment), null)
  assert.equal(quejaMailConfig({ ...environment, QUEJAS_MAIL_TRANSPORT: 'supabase' }), null)
  assert.equal(quejaMailConfig({ ...environment, QUEJAS_MAIL_TRANSPORT: 'legacy', QUEJAS_MAIL_ENABLED: 'false' }), null)
  assert.ok(quejaMailConfig({ ...environment, QUEJAS_MAIL_TRANSPORT: 'legacy' }))
})
const secret = 'synthetic-direct-mail-'.repeat(3)
const wakeSecret = 'synthetic-wake-only-'.repeat(3)
const queueUrl = 'https://fykhrrpeoehwqznccmfp.supabase.co/functions/v1/quejas-mail-queue'
const syntheticMessage = () => ({ eventId: randomUUID(), claimToken: randomUUID(), kind: 'recibido',
  to: 'controlled@example.test', subject: 'Registro recibido', body: 'Contenido sintético', folio: '2026-001' })
const signature = envelope => createHmac('sha256', secret).update(
  `eca-qms-mail:v1:${envelope.purpose}\n${envelope.issuedAt}\n${envelope.nonce}\n${envelope.payload}`
).digest('hex')
function sign(purpose, payload, now) {
  const envelope = { version: 1, purpose, issuedAt: Math.floor(now / 1000), nonce: randomUUID(),
    payload: Buffer.from(JSON.stringify(payload)).toString('base64url') }
  return { ...envelope, signature: signature(envelope) }
}

/** Dobles locales: HTTP, MailApp y Sheets no pueden alcanzar red ni datos institucionales. */
function fixture(options = {}) {
  const properties = { QMS_MAIL_SECRET: secret, QMS_MAIL_ENABLED: 'true', QMS_MAIL_TRANSPORT: 'supabase',
    QMS_MAIL_QUEUE_URL: queueUrl, QMS_MAIL_LEDGER_SPREADSHEET_ID: 'synthetic-ledger', ...options.properties }
  const rows = options.rows ?? [['event_id', 'hash', 'status', 'started_at', 'confirmed_at']]
  const sent = [], requests = [], logs = [], triggers = [], cache = new Map()
  const state = { now: Date.now(), locked: false, quota: options.quota ?? 100 }
  class Clock extends Date { static now() { return state.now } }
  const bytes = value => Array.from(Buffer.from(value))
  const range = (row, column, count = 1, width = 1) => ({
    getValues: () => rows.slice(row - 1, row - 1 + count).map(value => value.slice(column - 1, column - 1 + width)),
    setValue(value) { assert.equal(state.locked, true); rows[row - 1][column - 1] = value },
    createTextFinder: value => ({ matchEntireCell() { return this }, findNext() {
      const index = rows.findIndex((entry, index) => index > 0 && entry[0] === value)
      return index < 0 ? null : { getRow: () => index + 1 }
    } }),
  })
  const sheet = { getLastRow: () => rows.length, getRange: range,
    appendRow(row) { assert.equal(state.locked, true); rows.push(row) } }
  const messages = options.messages ?? [syntheticMessage()]
  const defaultResponse = request => {
    if (request.purpose === 'health_request') return { requestNonce: request.nonce, enabled: false }
    if (request.purpose === 'claim_request') return { requestNonce: request.nonce,
      leaseUntil: new Date(state.now + 540000).toISOString(), messages: messages.slice(0, request.decoded.limit) }
    if (request.purpose === 'authorize_request') return { requestNonce: request.nonce,
      eventId: request.decoded.eventId, authorized: true }
    return { requestNonce: request.nonce, eventId: request.decoded.eventId, accepted: true }
  }
  const context = {
    DriveApp: options.drive ?? { getFileById() { throw new Error('Drive unavailable in synthetic fixture') } },
    Date: Clock, JSON, Number, Array, Object,
    console: { info: (...args) => logs.push(['info', ...args]), warn: (...args) => logs.push(['warn', ...args]) },
    Utilities: { Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'sha256' }, getUuid: randomUUID,
      newBlob: value => ({ getBytes: () => bytes(value), getDataAsString: () => Buffer.from(value).toString('utf8') }),
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64DecodeWebSafe: value => bytes(Buffer.from(value, 'base64url')),
      computeHmacSha256Signature: (value, key) => bytes(createHmac('sha256', key).update(value).digest()),
      computeDigest: (_algorithm, value) => bytes(createHash('sha256').update(value).digest()),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name],
      setProperty(name, value) { assert.equal(state.locked, true); properties[name] = value },
      deleteProperty(name) { assert.equal(state.locked, true); delete properties[name] },
    }) },
    LockService: { getScriptLock: () => ({
      tryLock() { if (state.locked || options.lock === false) return false; state.locked = true; return true },
      releaseLock() { assert.equal(state.locked, true); state.locked = false },
    }) },
    SpreadsheetApp: { openById(id) { assert.equal(state.locked || options.allowUnlockedLedger === true, true); assert.equal(id, 'synthetic-ledger')
      if (options.noLedger) throw Error('synthetic missing ledger')
      return { getSheetByName: () => sheet }
    }, flush() { assert.equal(state.locked, true) } },
    MailApp: { getRemainingDailyQuota: () => state.quota, sendEmail(mail) {
      assert.equal(state.locked, true)
      assert.equal(rows.at(-1)[2], 'attempting', 'diario persistido antes de MailApp')
      sent.push(mail); state.quota--
      options.onSend?.({ state, properties, rows, sent })
      if (options.throwSend) throw Error('synthetic MailApp failure')
    } },
    UrlFetchApp: { fetch(url, settings) {
      assert.equal(state.locked, false, 'HTTP nunca mantiene ScriptLock')
      assert.equal(url, queueUrl, 'sin llamadas a Vercel, /exec u otros proyectos')
      assert.equal(settings.method, 'post'); assert.equal(settings.followRedirects, false)
      assert.equal(settings.muteHttpExceptions, true)
      assert.equal(settings.headers, undefined, 'GAS no guarda ni envía claves Supabase')
      const parsed = JSON.parse(settings.payload)
      assert.equal(parsed.signature, signature(parsed))
      const request = { ...parsed, decoded: JSON.parse(Buffer.from(parsed.payload, 'base64url').toString()) }
      requests.push(request)
      const payload = options.response ? options.response(request, { state, properties, messages, defaultResponse }) : defaultResponse(request)
      const purpose = request.purpose.replace('_request', '_receipt')
      const reply = sign(purpose, payload, state.now)
      const envelope = options.envelope ? options.envelope(reply, request) : reply
      return { getResponseCode: () => options.httpStatus ?? 200,
        getContentText: () => options.rawResponse ?? JSON.stringify(envelope) }
    } },
    ScriptApp: { getProjectTriggers: () => triggers, newTrigger(handler) {
      return { timeBased() { return this }, everyMinutes(minutes) { assert.equal(minutes, 5); return this },
        create() { triggers.push({ getHandlerFunction: () => handler }) } }
    } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType: () => value }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key)?.expires > state.now ? cache.get(key).value : null,
      put(key, value, seconds) { assert.equal(state.locked, true); cache.set(key, { value, expires: state.now + seconds * 1000 }) } }) },
  }
  vm.createContext(context); vm.runInContext(source, context)
  return { context, properties, rows, sent, requests, logs, state, messages, triggers,
    poll: () => context.qmsMailPoll() }
}

function wakeRequest(value, overrides = {}) {
  const envelope = { ...sign('queue_wake_request', {}, value.state.now), ...overrides }
  envelope.signature = createHmac('sha256', wakeSecret).update(
    `eca-qms-mail:v1:${envelope.purpose}\n${envelope.issuedAt}\n${envelope.nonce}\n${envelope.payload}`
  ).digest('hex')
  return { postData: { contents: JSON.stringify(envelope) } }
}

test('correo final adjunta solo el archivo autorizado y un reintento no lo vuelve a enviar', () => {
  let reads = 0
  const document = { driveId: 'synthetic_official_file', name: 'Informe final.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100 }
  const blob = { setName(name) { assert.equal(name, document.name); return this }, getBytes: () => Array(100).fill(1) }
  const value = fixture({ messages: [{ ...syntheticMessage(), kind: 'final' }], properties: { QMS_MAIL_ATTACH_OFFICIAL_DOCUMENTS: 'true' },
    drive: { getFileById(id) { reads++; assert.equal(id, document.driveId); return { isTrashed: () => false, getSize: () => 100, getMimeType: () => document.mime, getBlob: () => blob } } },
    response(request, { defaultResponse }) { return { ...defaultResponse(request), ...(request.purpose === 'authorize_request' ? { officialDocument: document } : {}) } },
  })
  value.poll(); value.poll()
  assert.equal(value.sent.length, 1); assert.equal(reads, 1)
  assert.equal(value.sent[0].attachments.length, 1); assert.equal(value.sent[0].attachments[0], blob)
  assert.equal(value.requests.find(request => request.purpose === 'authorize_request').decoded.includeOfficialDocument, true)
  assert.doesNotMatch(JSON.stringify(value.rows), /Informe final|synthetic_official_file/)
})

test('Drive inaccesible o metadata alterada falla antes de attempting/MailApp y permite reintento seguro', () => {
  for (const bad of ['missing', 'size', 'mime', 'receipt']) {
    const document = { driveId: 'synthetic_official_file', name: 'Oficio.pdf', mime: 'application/pdf', size: 100 }
    const value = fixture({ messages: [{ ...syntheticMessage(), kind: 'final' }], properties: { QMS_MAIL_ATTACH_OFFICIAL_DOCUMENTS: 'true' },
      drive: { getFileById() { if (bad === 'missing') throw Error('private account detail'); return { isTrashed: () => false, getSize: () => bad === 'size' ? 200 : 100, getMimeType: () => bad === 'mime' ? 'text/plain' : document.mime } } },
      response(request, { defaultResponse }) { return { ...defaultResponse(request), ...(request.purpose === 'authorize_request' ? { officialDocument: bad === 'receipt' ? { ...document, name: '../otro.pdf' } : document } : {}) } },
    })
    value.poll()
    assert.equal(value.sent.length, 0); assert.equal(value.rows.length, 1)
    const ack = value.requests.find(request => request.purpose === 'ack_request').decoded
    assert.equal(ack.outcome, 'retry'); assert.equal(ack.code, 'authorization_unavailable')
    assert.doesNotMatch(JSON.stringify(value.logs), /private account detail/)
  }
})

test('el despertador firmado usa el mismo emisor y diario sin aceptar datos de correo', () => {
  const value = fixture({ properties: { QMS_MAIL_WAKE_SECRET: wakeSecret } })
  const request = wakeRequest(value)
  const receipt = JSON.parse(value.context.doPost(request))
  const protocol = loadModule('lib/server/quejaMailProtocol.ts')
  const verified = protocol.verifyMailEnvelope(receipt, 'queue_wake_receipt', wakeSecret)
  assert.equal(verified.payload.status, 'accepted')
  assert.equal(verified.payload.requestNonce, JSON.parse(request.postData.contents).nonce)
  assert.equal(value.sent.length, 1)
  assert.deepEqual(value.requests.map(row => row.purpose), ['claim_request', 'ack_request'])
  assert.equal(JSON.parse(Buffer.from(JSON.parse(request.postData.contents).payload, 'base64url')).to, undefined)
  value.context.doPost(request)
  assert.equal(value.sent.length, 1, 'un replay no vuelve a reclamar la cola')
})

test('despertador inválido, sin secreto, apagado o legacy no reclama ni manda correo', () => {
  for (const properties of [{}, { QMS_MAIL_WAKE_SECRET: wakeSecret, QMS_MAIL_ENABLED: 'false' },
    { QMS_MAIL_WAKE_SECRET: wakeSecret, QMS_MAIL_TRANSPORT: 'legacy' }]) {
    const value = fixture({ properties })
    value.context.doPost(wakeRequest(value))
    assert.equal(value.requests.length, 0); assert.equal(value.sent.length, 0)
  }
  for (const override of [{ payload: Buffer.from('{"to":"synthetic@example.test"}').toString('base64url') },
    { issuedAt: 1 }, { nonce: 'invalid' }]) {
    const value = fixture({ properties: { QMS_MAIL_WAKE_SECRET: wakeSecret } })
    value.context.doPost(wakeRequest(value, override))
    assert.equal(value.requests.length, 0); assert.equal(value.sent.length, 0)
  }
  const altered = fixture({ properties: { QMS_MAIL_WAKE_SECRET: wakeSecret } })
  const request = wakeRequest(altered)
  const envelope = JSON.parse(request.postData.contents); envelope.signature = '0'.repeat(64)
  altered.context.doPost({ postData: { contents: JSON.stringify(envelope) } })
  assert.equal(altered.requests.length, 0)
})

test('el despertador y el activador periódico comparten la reserva del poll', () => {
  const value = fixture({ properties: { QMS_MAIL_WAKE_SECRET: wakeSecret } })
  value.properties.QMS_MAIL_POLL_OWNER = 'other-poll'
  value.properties.QMS_MAIL_POLL_UNTIL = String(value.state.now + 60000)
  value.context.doPost(wakeRequest(value))
  assert.equal(value.requests.length, 0); assert.equal(value.sent.length, 0)
  assert.equal(value.properties.QMS_MAIL_POLL_OWNER, 'other-poll')
})

test('flag apagado evita HTTP, cola y MailApp incluso con configuración antigua preparada', () => {
  const value = fixture({ properties: { QMS_MAIL_ENABLED: 'false', QMS_MAIL_WORKER_URL: 'https://fixture/api/quejas/correos' } })
  value.poll(); assert.equal(value.requests.length, 0); assert.equal(value.sent.length, 0); assert.equal(value.rows.length, 1)
})

test('directo reclama cinco snapshots y confirma cada entrega sin callback ni credenciales Supabase', () => {
  const value = fixture({ messages: Array.from({ length: 5 }, syntheticMessage) })
  value.poll()
  assert.deepEqual(value.requests.map(request => request.purpose), ['claim_request', ...Array(5).fill('ack_request')])
  assert.equal(value.sent.length, 5); assert.ok(value.rows.slice(1).every(row => row[2] === 'sent'))
  assert.ok(value.requests.slice(1).every(request => request.decoded.outcome === 'sent' && request.decoded.code === 'sent'))
  assert.ok(value.sent.every(mail => mail.name === 'QMS ECA' && mail.htmlBody.includes('#024796')))
  assert.doesNotMatch(JSON.stringify(value.rows), /controlled@example|Contenido sintético|2026-001/)
  assert.doesNotMatch(JSON.stringify(value.logs), /controlled@example|Contenido sintético|signature|synthetic-direct-mail/)
  assert.equal(value.properties.QMS_MAIL_POLL_OWNER, undefined)
  assert.equal(value.properties.QMS_MAIL_POLL_UNTIL, undefined)
})

test('cuota y diario se verifican antes del claim y el límite se ajusta a la cuota disponible', () => {
  for (const options of [{ quota: 0 }, { quota: Number.NaN }, { noLedger: true }]) {
    const value = fixture(options); value.poll()
    assert.equal(value.requests.length, 1)
    assert.equal(value.requests[0].purpose, 'claim_request')
    assert.equal(value.requests[0].decoded.limit, 0)
    assert.equal(value.sent.length, 0)
    assert.equal(value.rows.length, 1)
  }
  const locked = fixture({ lock: false }); locked.poll(); assert.equal(locked.requests.length, 0)
  const value = fixture({ quota: 2, messages: Array.from({ length: 5 }, syntheticMessage) })
  value.poll(); assert.equal(value.requests[0].decoded.limit, 2); assert.equal(value.sent.length, 2)
})

test('claim0 rechaza mensajes inesperados y no consulta authorize, ACK ni MailApp', () => {
  const value = fixture({ quota: 0, response(request, { state }) {
    return { requestNonce: request.nonce, leaseUntil: new Date(state.now + 540000).toISOString(), messages: [syntheticMessage()] }
  } })
  value.poll()
  assert.equal(value.requests.length, 1)
  assert.equal(value.requests[0].decoded.limit, 0)
  assert.equal(value.sent.length, 0)
  assert.equal(value.rows.length, 1)
})

test('tick cuota0 de GAS interopera con Edge real sin reservar eventos, escribir attempting o mandar ACK', async () => {
  const value = fixture({ quota: 0 })
  value.poll()
  assert.equal(value.requests.length, 1)
  const { decoded, ...input } = value.requests[0]
  assert.deepEqual(decoded, { limit: 0 })
  const queue = loadModule('supabase/functions/quejas-mail-queue/index.ts', {}, { crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob })
  const calls = []
  const environment = { QUEJAS_MAIL_SIGNING_SECRET: secret, QUEJAS_MAIL_QUEUE_ENABLED: 'true',
    SUPABASE_URL: 'https://syntheticproject.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture-never-real-key' }
  const handler = queue.createQuejasMailQueueHandler({ env: name => environment[name], crypto: webcrypto,
    now: () => value.state.now, fetcher: async (url, options) => {
      calls.push({ url, args: JSON.parse(options.body) })
      assert.equal(url.endsWith('/qms_mail_claim_batch_v2'), true)
      assert.equal(JSON.parse(options.body).p_limit, 0)
      return Response.json([])
    } })
  const response = await handler(new Request(queueUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }))
  assert.equal(response.status, 200)
  const receipt = value.context.qmsMailVerify_(await response.json(), 'claim_receipt', secret, 65536)
  const batch = value.context.qmsMailClaimReceipt_(receipt.payload, 0)
  assert.equal(batch.messages.length, 0)
  assert.equal(receipt.payload.requestNonce, input.nonce)
  assert.equal(calls.length, 1)
  assert.equal(value.requests.length, 1)
  assert.equal(value.rows.length, 1)
  assert.equal(value.sent.length, 0)
})

test('URL alterada no usa fallback Vercel ni envía un secreto a otro destino', () => {
  for (const url of [queueUrl + '?x=1', queueUrl + '/', queueUrl.replace('fykhrrpeoehwqznccmfp', 'another-project'), 'https://fixture/api/quejas/correos']) {
    const value = fixture({ properties: { QMS_MAIL_QUEUE_URL: url } })
    assert.throws(value.poll, /queue_not_configured/); assert.equal(value.requests.length, 0); assert.equal(value.sent.length, 0)
  }
})

test('firma, propósito y nonce de claim falsificados impiden cualquier entrega', () => {
  const alterations = [reply => ({ ...reply, signature: '0'.repeat(64) }),
    reply => ({ ...reply, purpose: 'delivery_receipt' }), reply => ({ ...reply, unexpected: true }),
    (reply, request) => sign('claim_receipt', { requestNonce: randomUUID(), leaseUntil: new Date(Date.now() + 300000).toISOString(), messages: [syntheticMessage()] }, request.issuedAt * 1000),
  ]
  for (const envelope of alterations) {
    const value = fixture({ envelope }); value.poll()
    assert.equal(value.requests.length, 1); assert.equal(value.sent.length, 0); assert.equal(value.rows.length, 1)
  }
})

test('se valida todo el lote: un mensaje posterior inválido o duplicado bloquea también el primero', () => {
  const first = syntheticMessage()
  const invalid = [{ ...syntheticMessage(), to: 'a@example.test,b@example.test' },
    { ...syntheticMessage(), claimToken: 'not-a-uuid' }, { ...first, claimToken: randomUUID() },
    { ...syntheticMessage(), kind: 'internal' }, { ...syntheticMessage(), body: 'a'.repeat(6001) },
    { ...syntheticMessage(), internalNotes: 'synthetic private' }]
  for (const second of invalid) {
    const value = fixture({ messages: [first, second] }); value.poll()
    assert.equal(value.sent.length, 0); assert.equal(value.requests.length, 1); assert.equal(value.rows.length, 1)
  }
})

test('Apps Script rechaza investigación ciudadana antes de MailApp incluso firmada y mezclada con recibido', () => {
  const retired = { ...syntheticMessage(), kind: 'investigacion' }
  for (const messages of [[retired], [syntheticMessage(), retired]]) {
    const value = fixture({ messages }); value.poll()
    assert.equal(value.sent.length, 0)
    assert.equal(value.rows.length, 1, 'no escribe attempting ni altera el diario')
    assert.equal(value.requests.length, 1, 'el lote retirado no produce ACK ni autorización')
    const delivery = { ...retired }; delete delivery.claimToken
    assert.equal(value.context.qmsMailValidMessage_(delivery, false), false)
    assert.equal(value.context.qmsMailValidMessage_(delivery, true), false)
  }
})

test('batch demasiado grande, campos extra, lease vencido o ajeno al contrato fallan antes de MailApp', () => {
  const alter = [payload => ({ ...payload, messages: Array.from({ length: 6 }, syntheticMessage) }),
    payload => ({ ...payload, leaseUntil: new Date(Date.now() - 1000).toISOString() }),
    payload => ({ ...payload, leaseUntil: new Date(Date.now() + 601000).toISOString() }),
    payload => ({ ...payload, leaseUntil: 1791849600 }), payload => ({ ...payload, surprise: true }),
    payload => ({ ...payload, messages: null })]
  for (const update of alter) {
    const value = fixture({ response: (request, { defaultResponse }) => update(defaultResponse(request)) }); value.poll()
    assert.equal(value.sent.length, 0); assert.equal(value.requests.length, 1)
  }
})

test('ACK perdido detiene el lote y el diario permite recuperar sin reenviar el correo aceptado', () => {
  const messages = [syntheticMessage(), syntheticMessage()]
  const first = fixture({ messages, response(request, { defaultResponse }) {
    if (request.purpose === 'ack_request') throw Error('synthetic timeout')
    return defaultResponse(request)
  } })
  first.poll(); assert.equal(first.sent.length, 1); assert.equal(first.rows[1][2], 'sent'); assert.equal(first.requests.length, 2)
  const recovery = fixture({ rows: first.rows, messages })
  recovery.poll(); assert.equal(recovery.sent.length, 1)
  assert.equal(recovery.requests[1].decoded.code, 'already_sent')
  assert.equal(recovery.requests[2].decoded.eventId, messages[1].eventId)
})

test('ACK falso, firmado para otro evento o correlación ajena no se anuncia como confirmado', () => {
  for (const update of [payload => ({ ...payload, accepted: false }), payload => ({ ...payload, eventId: randomUUID() }),
    payload => ({ ...payload, requestNonce: randomUUID() }), payload => ({ ...payload, extra: true })]) {
    const value = fixture({ messages: [syntheticMessage(), syntheticMessage()], response(request, { defaultResponse }) {
      const payload = defaultResponse(request); return request.purpose === 'ack_request' ? update(payload) : payload
    } })
    value.poll(); assert.equal(value.sent.length, 1); assert.equal(value.requests.length, 2)
    assert.equal(value.logs.filter(([level]) => level === 'info').length, 0)
  }
})

test('incertidumbre de MailApp bloquea reenvío automático y payload distinto no reutiliza el evento', () => {
  const message = syntheticMessage(), value = fixture({ messages: [message], throwSend: true })
  value.poll(); value.poll()
  assert.equal(value.sent.length, 1); assert.equal(value.rows[1][2], 'uncertain')
  assert.equal(value.requests.at(-1).decoded.outcome, 'uncertain')
  const conflict = fixture({ rows: value.rows, messages: [{ ...message, body: 'Contenido cambiado' }] })
  conflict.poll(); assert.equal(conflict.sent.length, 0); assert.equal(conflict.requests[1].decoded.code, 'event_conflict')
})

test('claim timeout o redirección no se repiten y nunca envían', () => {
  for (const options of [{ response() { throw Error('synthetic network timeout') } }, { httpStatus: 302 }, { httpStatus: 401 }, { rawResponse: 'x'.repeat(65537) }]) {
    const value = fixture(options); value.poll(); assert.equal(value.requests.length, 1); assert.equal(value.sent.length, 0)
  }
})

test('generación de poll reserva seis minutos y finally no elimina una reserva posterior', () => {
  const owner = randomUUID()
  const value = fixture({ response(request, { properties, state, defaultResponse }) {
    assert.equal(Number(properties.QMS_MAIL_POLL_UNTIL) - state.now, 360000)
    properties.QMS_MAIL_POLL_OWNER = owner; properties.QMS_MAIL_POLL_UNTIL = String(state.now + 400000)
    return { ...defaultResponse(request), messages: [] }
  } })
  value.poll(); assert.equal(value.properties.QMS_MAIL_POLL_OWNER, owner)
  const requests = value.requests.length; value.poll(); assert.equal(value.requests.length, requests)
})

test('presupuesto/lease corto confirma retry sin empezar entrega y respeta el límite de ejecución', () => {
  const messages = [syntheticMessage(), syntheticMessage()]
  const value = fixture({ messages, response(request, { state, defaultResponse }) {
    const payload = defaultResponse(request)
    if (request.purpose === 'claim_request') { state.now += 220000; payload.leaseUntil = new Date(state.now + 10000).toISOString() }
    return payload
  } })
  value.poll(); assert.equal(value.sent.length, 0)
  assert.ok(value.requests.slice(1).every(request => request.decoded.code === 'batch_not_started'))
  const elapsed = fixture({ response(request, { state, defaultResponse }) {
    const payload = defaultResponse(request); state.now += 241000
    payload.leaseUntil = new Date(state.now + 200000).toISOString(); return payload
  } })
  elapsed.poll(); assert.equal(elapsed.sent.length, 0); assert.equal(elapsed.requests.length, 1)
})

test('apagar flag después del claim impide MailApp y confirma disabled', () => {
  const value = fixture({ response(request, { properties, defaultResponse }) {
    if (request.purpose === 'claim_request') properties.QMS_MAIL_ENABLED = 'false'
    return defaultResponse(request)
  } })
  value.poll(); assert.equal(value.sent.length, 0); assert.equal(value.requests[1].decoded.code, 'disabled')
})

test('health firmado opera apagado y solo expone estado, sin diario, claims ni MailApp', () => {
  const value = fixture({ noLedger: true, properties: { QMS_MAIL_ENABLED: 'false' } })
  assert.deepEqual(JSON.parse(JSON.stringify(value.context.qmsMailCheckConnection())), { reachable: true, enabled: false })
  assert.equal(value.requests.length, 1); assert.equal(value.requests[0].purpose, 'health_request')
  assert.deepEqual(value.requests[0].decoded, {}); assert.equal(value.sent.length, 0)
  assert.doesNotMatch(JSON.stringify(value.logs), /signature|controlled@example|synthetic-direct-mail/)
})

test('health alterado o con extra no anuncia conexión verificada', () => {
  for (const options of [{ envelope: reply => ({ ...reply, signature: '0'.repeat(64) }) },
    { response: () => ({ requestNonce: randomUUID(), enabled: false }) },
    { response: request => ({ requestNonce: request.nonce, enabled: false, rows: 5 }) },
    { response: request => ({ requestNonce: request.nonce, enabled: 'false' }) }]) {
    const value = fixture(options); assert.throws(() => value.context.qmsMailCheckConnection())
    assert.equal(value.logs.length, 0); assert.equal(value.sent.length, 0)
  }
})

test('instalador directo comprueba flag/URL y conserva un único trigger cada cinco minutos', () => {
  const value = fixture({ allowUnlockedLedger: true })
  value.context.qmsMailInstallTrigger(); value.context.qmsMailInstallTrigger(); assert.equal(value.triggers.length, 1)
  const disabled = fixture({ allowUnlockedLedger: true, properties: { QMS_MAIL_ENABLED: 'false' } })
  assert.throws(() => disabled.context.qmsMailInstallTrigger(), /worker_not_configured/); assert.equal(disabled.triggers.length, 0)
  const altered = fixture({ allowUnlockedLedger: true, properties: { QMS_MAIL_QUEUE_URL: 'https://another.example/' } })
  assert.throws(() => altered.context.qmsMailInstallTrigger(), /queue_not_configured/); assert.equal(altered.triggers.length, 0)
})

test('modo directo no admite delivery_request legacy aunque sea firmado correctamente', () => {
  const value = fixture(), message = { ...value.messages[0] }; delete message.claimToken
  const envelope = sign('delivery_request', message, value.state.now)
  const response = JSON.parse(value.context.doPost({ postData: { contents: JSON.stringify(envelope) } }))
  assert.equal(response.purpose, 'delivery_receipt'); assert.equal(response.signature, signature(response))
  const receipt = JSON.parse(Buffer.from(response.payload, 'base64url').toString())
  assert.equal(receipt.code, 'disabled'); assert.equal(value.sent.length, 0); assert.equal(value.requests.length, 0)
})

test('Código.gs y Edge real interoperan health, claim interno, authorize y ACK sin red', async () => {
  const value = fixture({ properties: { QMS_MAIL_ENABLED: 'false' } })
  const queue = loadModule('supabase/functions/quejas-mail-queue/index.ts', {}, { crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob })
  const row = { id: randomUUID(), claim_token: randomUUID(), tipo: 'interno_investigacion_3', destinatario: 'controlled@example.test',
    folio: '2026-001', estado: 'En Investigación', numero_oficio: null }
  const environment = { QUEJAS_MAIL_SIGNING_SECRET: secret, QUEJAS_MAIL_QUEUE_ENABLED: 'true',
    SUPABASE_URL: 'https://syntheticproject.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture-never-real-key' }
  const calls = []
  const handler = queue.createQuejasMailQueueHandler({ env: name => environment[name], crypto: webcrypto,
    now: () => value.state.now, fetcher: async (url, options) => {
      calls.push({ url, args: JSON.parse(options.body) })
      return Response.json(url.endsWith('/qms_mail_claim_batch_v2') ? [row] : true)
    } })
  for (const [purpose, payload] of [['health_request', {}], ['claim_request', { limit: 1 }],
    ['authorize_request', { eventId: row.id, claimToken: row.claim_token }],
    ['ack_request', { eventId: row.id, claimToken: row.claim_token, outcome: 'sent', code: 'sent', retryAfterSeconds: 300 }]]) {
    const input = value.context.qmsMailSign_(purpose, payload, secret)
    const response = await handler(new Request(queueUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }))
    assert.equal(response.status, 200)
    const receipt = value.context.qmsMailVerify_(await response.json(), purpose.replace('_request', '_receipt'), secret, 65536)
    assert.equal(receipt.payload.requestNonce, input.nonce)
    if (purpose === 'health_request') { assert.equal(calls.length, 0); assert.equal(receipt.payload.enabled, true) }
    if (purpose === 'claim_request') {
      const batch = value.context.qmsMailClaimReceipt_(receipt.payload, 1)
      assert.equal(batch.messages[0].message.eventId, row.id)
      assert.equal(batch.messages[0].claimToken, row.claim_token)
      assert.equal(batch.messages[0].message.kind, 'interno_investigacion_3')
      assert.match(batch.messages[0].message.body, /3 días hábiles/)
      assert.equal(batch.expires, value.state.now - value.state.now % 1000 + 540000)
    }
    if (purpose === 'authorize_request') {
      assert.equal(receipt.payload.eventId, row.id)
      assert.equal(receipt.payload.authorized, true)
      assert.equal(calls.at(-1).url.endsWith('/qms_mail_authorize'), true)
      assert.deepEqual(calls.at(-1).args, { p_id: row.id, p_claim_token: row.claim_token })
    }
    if (purpose === 'ack_request') assert.equal(receipt.payload.accepted, true)
  }
  assert.equal(calls.length, 3); assert.equal(value.sent.length, 0); assert.equal(value.requests.length, 0)
})

const internalKinds = ['interno_recibido', 'interno_evaluacion_1', 'interno_asignacion', 'interno_investigacion_5',
  'interno_investigacion_3', 'interno_evaluacion_vencida', 'interno_investigacion_vencida']

test('cada aviso interno autoriza justo antes de MailApp y conserva HTML compacto y diario sin PII', () => {
  for (const kind of internalKinds) {
    const message = { ...syntheticMessage(), kind }
    const value = fixture({ messages: [message] })
    value.poll()
    assert.deepEqual(value.requests.map(request => request.purpose), ['claim_request', 'authorize_request', 'ack_request'])
    assert.deepEqual(value.requests[1].decoded, { eventId: message.eventId, claimToken: message.claimToken })
    assert.equal(value.sent.length, 1)
    assert.match(value.sent[0].htmlBody, /max-width:760px/)
    assert.doesNotMatch(value.sent[0].htmlBody, /undefined|<(script|img|iframe)\b/)
    assert.equal(value.requests[2].decoded.outcome, 'sent')
    assert.equal(value.rows[1][2], 'sent')
    assert.doesNotMatch(JSON.stringify(value.rows), /controlled@example|Contenido sintético|2026-001/)
  }
})

test('un lote mixto autoriza únicamente los eventos internos', () => {
  const value = fixture({ messages: [syntheticMessage(), { ...syntheticMessage(), kind: 'interno_investigacion_3' }, syntheticMessage()] })
  value.poll()
  assert.equal(value.sent.length, 3)
  assert.deepEqual(value.requests.map(request => request.purpose),
    ['claim_request', 'ack_request', 'authorize_request', 'ack_request', 'ack_request'])
})

test('un aviso interno obsoleto confirma skipped sin MailApp ni filas attempting', () => {
  const value = fixture({ messages: [{ ...syntheticMessage(), kind: 'interno_asignacion' }], response(request, { defaultResponse }) {
    return request.purpose === 'authorize_request' ? { ...defaultResponse(request), authorized: false } : defaultResponse(request)
  } })
  value.poll()
  assert.equal(value.sent.length, 0)
  assert.equal(value.rows.length, 1)
  assert.equal(value.requests[2].decoded.outcome, 'skipped')
  assert.equal(value.requests[2].decoded.code, 'obsolete_notice')
  assert.equal(JSON.parse(value.logs.at(-1)[2]).skipped, 1)
})

test('authorize con nonce, evento, tipo booleano, campos o firma inválidos no consume el diario', () => {
  const alterations = [payload => ({ ...payload, requestNonce: randomUUID() }),
    payload => ({ ...payload, eventId: randomUUID() }), payload => ({ ...payload, authorized: 'true' }),
    payload => ({ ...payload, extra: true }), payload => ({ requestNonce: payload.requestNonce, eventId: payload.eventId })]
  for (const update of alterations) {
    const value = fixture({ messages: [{ ...syntheticMessage(), kind: 'interno_recibido' }], response(request, { defaultResponse }) {
      const payload = defaultResponse(request)
      return request.purpose === 'authorize_request' ? update(payload) : payload
    } })
    value.poll()
    assert.equal(value.sent.length, 0)
    assert.equal(value.rows.length, 1)
    assert.equal(value.requests[2].decoded.outcome, 'retry')
    assert.equal(value.requests[2].decoded.code, 'authorization_unavailable')
  }
  for (const update of [reply => ({ ...reply, signature: '0'.repeat(64) }), reply => ({ ...reply, purpose: 'ack_receipt' })]) {
    const value = fixture({ messages: [{ ...syntheticMessage(), kind: 'interno_evaluacion_1' }], envelope(reply, request) {
      return request.purpose === 'authorize_request' ? update(reply) : reply
    } })
    value.poll()
    assert.equal(value.sent.length, 0)
    assert.equal(value.rows.length, 1)
    assert.equal(value.requests[2].decoded.code, 'authorization_unavailable')
  }
})

test('authorize que falla en transporte reintenta antes de enviar y no bloquea otro aviso ciudadano', () => {
  const value = fixture({ messages: [{ ...syntheticMessage(), kind: 'interno_investigacion_5' }, syntheticMessage()],
    response(request, { defaultResponse }) {
      if (request.purpose === 'authorize_request') throw Error('synthetic authorization timeout')
      return defaultResponse(request)
    } })
  value.poll()
  assert.equal(value.sent.length, 1)
  assert.equal(value.rows.length, 2)
  assert.equal(value.requests[2].decoded.code, 'authorization_unavailable')
  assert.equal(value.requests[2].decoded.outcome, 'retry')
  assert.equal(value.requests[3].decoded.outcome, 'sent')
})

test('el presupuesto se vuelve a comprobar tras el HTTP authorize y apagar flag evita entregar', () => {
  for (const mutate of [({ state }) => { state.now += 220000 }, ({ properties }) => { properties.QMS_MAIL_ENABLED = 'false' }]) {
    const value = fixture({ messages: [{ ...syntheticMessage(), kind: 'interno_investigacion_vencida' }],
      response(request, context) {
        const reply = context.defaultResponse(request)
        if (request.purpose === 'authorize_request') mutate(context)
        return reply
      } })
    value.poll()
    assert.equal(value.sent.length, 0)
    assert.equal(value.rows.length, 1)
    assert.equal(value.requests[2].decoded.outcome, 'retry')
    assert.ok(['disabled', 'batch_not_started'].includes(value.requests[2].decoded.code))
  }
})

test('un envío interno ya intentado conserva sent/uncertain/conflict sin nueva autorización ni reenvío', () => {
  for (const throwSend of [false, true]) {
    const message = { ...syntheticMessage(), kind: 'interno_evaluacion_vencida' }
    const value = fixture({ messages: [message], throwSend })
    value.poll(); value.poll()
    assert.equal(value.sent.length, 1)
    assert.equal(value.requests.filter(request => request.purpose === 'authorize_request').length, 1)
    assert.equal(value.requests.at(-1).decoded.outcome, throwSend ? 'uncertain' : 'sent')
    const conflict = fixture({ rows: value.rows, messages: [{ ...message, body: 'Texto distinto' }] })
    conflict.poll()
    assert.equal(conflict.sent.length, 0)
    assert.equal(conflict.requests.at(-1).decoded.code, 'event_conflict')
    assert.equal(conflict.requests.filter(request => request.purpose === 'authorize_request').length, 0)
  }
})

test('endpoint legacy rechaza todos los tipos internos aunque tengan firma correcta y transporte legacy', () => {
  for (const kind of internalKinds) {
    const value = fixture({ properties: { QMS_MAIL_TRANSPORT: 'legacy' } })
    const message = { ...syntheticMessage(), kind }; delete message.claimToken
    const envelope = sign('delivery_request', message, value.state.now)
    const reply = JSON.parse(value.context.doPost({ postData: { contents: JSON.stringify(envelope) } }))
    assert.equal(reply.signature, signature(reply))
    const outcome = JSON.parse(Buffer.from(reply.payload, 'base64url').toString())
    assert.equal(outcome.outcome, 'failed')
    assert.equal(outcome.code, 'invalid_delivery')
    assert.equal(value.sent.length, 0)
    assert.equal(value.requests.length, 0)
    assert.equal(value.rows.length, 1)
  }
})
