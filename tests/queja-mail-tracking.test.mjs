import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createHash, randomUUID, webcrypto } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const globals = { crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob }
const queue = loadModule('supabase/functions/quejas-mail-queue/index.ts', {}, globals)
const messages = loadModule('supabase/functions/quejas-mail-queue/message.ts', {}, globals)
const capability = loadModule('supabase/functions/_shared/publicTrackingCapability.ts', {}, globals)
const secret = 'synthetic-mailer-key-for-unit-tests-only'
const trackingSecret = 'synthetic-dedicated-tracking-key-for-tests'
const now = 1_791_820_800_000
const origin = 'https://qms.example.test'
const canonical = value => JSON.parse(JSON.stringify(value))
const snapshot = (patch = {}) => ({ id: randomUUID(), claim_token: randomUUID(), tipo: 'recibido',
  destinatario: 'person@example.test', folio: '2026-001', estado: 'Recibido', numero_oficio: null,
  public_tracking: { queja_id: randomUUID(), nonce: randomUUID() }, ...patch })

async function claim(rows, environment = {}, at = now) {
  const calls = []
  const env = { QUEJAS_MAIL_SIGNING_SECRET: secret, QUEJAS_MAIL_QUEUE_ENABLED: 'true',
    SUPABASE_URL: 'https://fixtureproject.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
    PUBLIC_TRACKING_ENABLED: 'true', PUBLIC_TRACKING_SIGNING_SECRET: trackingSecret, PUBLIC_TRACKING_ORIGIN: origin, ...environment }
  const handler = queue.createQuejasMailQueueHandler({ env: name => env[name], now: () => at, crypto: webcrypto,
    fetcher: async (target, init) => { calls.push({ target, init }); return Response.json(rows) } })
  const input = await queue.signQueueEnvelope('claim_request', { limit: 5 }, secret, webcrypto, at)
  const response = await handler(new Request('https://fixtureproject.supabase.co/functions/v1/quejas-mail-queue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }))
  const envelope = await response.json()
  const receipt = response.status === 200 ? JSON.parse(Buffer.from(envelope.payload, 'base64url').toString()) : envelope
  return { response, receipt, calls }
}

function appsScript(properties = {}) {
  const props = { QMS_PUBLIC_TRACKING_ORIGIN: origin, ...properties }
  const bytes = value => Array.from(Buffer.from(value))
  const context = { console, Date, JSON, Number, Array, Object,
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => props[name] }) },
    Utilities: { Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_algorithm, text) => bytes(createHash('sha256').update(text).digest()),
    },
  }
  vm.createContext(context)
  vm.runInContext(fs.readFileSync('integration/apps-script/quejas-mail/Codigo.gs', 'utf8'), context)
  return context
}

test('los dos hitos ciudadanos generan link privado determinista mediante v3; nunca envían secretos', async () => {
  const rows = ['recibido', 'final'].map(tipo => snapshot({ tipo, estado: tipo === 'final' ? 'Resuelto' : 'Recibido', numero_oficio: 'ECA-GC-2026-001' }))
  const first = await claim(rows), second = await claim(rows)
  assert.equal(first.response.status, 200)
  assert.match(first.calls[0].target, /\/qms_mail_claim_batch_v3$/)
  assert.deepEqual(first.receipt.messages, second.receipt.messages)
  for (let index = 0; index < rows.length; index++) {
    const message = first.receipt.messages[index], row = rows[index], url = new URL(message.trackingUrl)
    assert.equal(url.origin, origin)
    const claims = await capability.verifyPublicTrackingCapability(url.hash.slice('#clave='.length), trackingSecret, { crypto: webcrypto })
    assert.equal(claims.quejaId, row.public_tracking.queja_id)
    assert.equal(claims.nonce, row.public_tracking.nonce)
    assert.match(message.body, /Seguimiento privado: https:/)
    assert.equal(JSON.stringify(message).includes(trackingSecret), false)
    assert.equal(Object.keys(message).includes('public_tracking'), false)
  }
  assert.match(first.receipt.messages[1].body, /respuesta y el oficio/)
  assert.doesNotMatch(first.receipt.messages[1].body, /contactá a Gestión/)
})

test('tracking no rehabilita el correo ciudadano de investigación retirado', async () => {
  const result = await claim([snapshot({ tipo: 'investigacion', estado: 'En Investigación' })])
  assert.equal(result.response.status, 503)
  assert.deepEqual(result.receipt, { error: 'mail_queue_unavailable' })
  const script = appsScript()
  const message = { eventId: randomUUID(), kind: 'investigacion', to: 'person@example.test',
    folio: '2026-001', subject: 'En investigación', body: 'Este mensaje no debe enviarse.' }
  assert.equal(script.qmsMailValidMessage_(message, false), false)
  assert.equal(script.qmsMailValidMessage_(message, true), false)
  assert.throws(() => script.qmsMailHtml_(message), /invalid_mail_request/)
})

test('snapshot nulo y flag ausente preservan exactamente mensajes legacy y RPCv2', async () => {
  const row = snapshot({ public_tracking: null })
  const result = await claim([row])
  const expected = { ...messages.quejaMailMessage(messages.claimMailSnapshot(row)), claimToken: row.claim_token }
  assert.deepEqual(result.receipt.messages[0], canonical(expected))
  assert.equal(Object.hasOwn(result.receipt.messages[0], 'trackingUrl'), false)
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    const disabled = await claim([row], { PUBLIC_TRACKING_ENABLED: flag, PUBLIC_TRACKING_SIGNING_SECRET: undefined, PUBLIC_TRACKING_ORIGIN: undefined })
    assert.equal(disabled.response.status, 200)
    assert.match(disabled.calls[0].target, /\/qms_mail_claim_batch_v2$/)
    assert.deepEqual(disabled.receipt.messages[0], canonical(expected))
  }
})

test('config inválida falla antes de reservar cola y snapshot inválido no filtra capacidad', async () => {
  for (const env of [{ PUBLIC_TRACKING_SIGNING_SECRET: undefined }, { PUBLIC_TRACKING_SIGNING_SECRET: 'short' },
    { PUBLIC_TRACKING_ORIGIN: 'https://wrong.example/path' }, { PUBLIC_TRACKING_ORIGIN: 'http://localhost:3000' }]) {
    const value = await claim([snapshot()], env)
    assert.equal(value.response.status, 503)
    assert.equal(value.calls.length, 0)
    assert.deepEqual(value.receipt, { error: 'mail_queue_unavailable' })
  }
  for (const public_tracking of [{}, { queja_id: randomUUID(), nonce: 'bad' },
    { ...snapshot().public_tracking, extra: 'PRIVATE_TEXT' }, { ...snapshot().public_tracking, expires_at: new Date(now).toISOString() }]) {
    const value = await claim([snapshot({ public_tracking })])
    assert.equal(value.response.status, 503)
    assert.deepEqual(value.receipt, { error: 'mail_queue_unavailable' })
  }
})

test('lote mixto y reintento tardío conservan URL/cuerpo/hash aunque la DB ya haya cerrado el acceso', async () => {
  // El snapshot no replica el reloj mutable de acceso. El emisor reproduce el correo;
  // las APIs de consulta/descarga verifican el vencimiento real en cada solicitud.
  const rows = [snapshot(), snapshot({ tipo: 'final', estado: 'Resuelto', numero_oficio: 'ECA-GC-2026-002' })]
  const initial = await claim(rows)
  const afterClosureWindow = await claim(rows, {}, now + 400 * 86400000)
  assert.equal(initial.response.status, 200)
  assert.equal(afterClosureWindow.response.status, 200)
  assert.equal(afterClosureWindow.receipt.messages.length, 2)
  assert.deepEqual(afterClosureWindow.receipt.messages, initial.receipt.messages)
  const script = appsScript()
  for (let index = 0; index < rows.length; index++) {
    const before = { ...initial.receipt.messages[index] }, after = { ...afterClosureWindow.receipt.messages[index] }
    delete before.claimToken
    delete after.claimToken
    assert.equal(script.qmsMailFingerprint_(after), script.qmsMailFingerprint_(before))
    assert.equal(script.qmsMailValidMessage_(after, true), true)
    const wire = JSON.parse(Buffer.from(new URL(after.trackingUrl).hash.slice('#clave='.length).split('.')[0], 'base64url').toString())
    assert.deepEqual(Object.keys(wire), ['purpose', 'queja_id', 'nonce'])
  }
})

test('todos los avisos internos omiten tracking aunque la DB lo incluya', async () => {
  const rows = messages.INTERNAL_MAIL_KINDS.map(tipo => snapshot({ tipo }))
  for (const row of rows) {
    const projected = messages.claimMailSnapshot(row, { internal: true })
    assert.equal(Object.hasOwn(projected, 'public_tracking'), false)
    const message = messages.quejaMailMessage(projected, { trackingUrl: 'https://evil.example' })
    assert.equal(Object.hasOwn(message, 'trackingUrl'), false)
    const result = await claim([row])
    assert.equal(result.response.status, 200)
    assert.equal(Object.hasOwn(result.receipt.messages[0], 'trackingUrl'), false)
  }
})

test('Apps Script conserva hash legacy, integra URL en hash nuevo y muestra botón sin recursos remotos', async () => {
  const script = appsScript(), result = await claim([snapshot()]), message = result.receipt.messages[0]
  delete message.claimToken
  const legacy = { ...message }; delete legacy.trackingUrl
  const expected = createHash('sha256').update(JSON.stringify([legacy.eventId, legacy.kind, legacy.to, legacy.subject, legacy.body, legacy.folio])).digest('hex')
  assert.equal(script.qmsMailFingerprint_(legacy), expected)
  assert.notEqual(script.qmsMailFingerprint_(message), expected)
  assert.notEqual(script.qmsMailFingerprint_(message), script.qmsMailFingerprint_({ ...message, trackingUrl: `${message.trackingUrl}A` }))
  assert.equal(script.qmsMailValidMessage_(message, true), true)
  const html = script.qmsMailHtml_(message)
  assert.match(html, /Consultar mi trámite/)
  assert.match(html, /sin contraseña/)
  assert.match(html, /href="https:\/\/qms\.example\.test\/q\/seguimiento#clave=/)
  assert.match(html, /max-width:760px/)
  assert.doesNotMatch(html, /Seguimiento privado:/)
  assert.doesNotMatch(html, /<(?:script|iframe|img|link)\b/)
})

test('URLs maliciosas, origen distinto, propiedad ausente o links internos se rechazan antes de envío', async () => {
  const script = appsScript(), result = await claim([snapshot()]), message = result.receipt.messages[0]
  delete message.claimToken
  for (const trackingUrl of ['javascript:alert(1)', message.trackingUrl.replace(origin, 'https://evil.example'),
    `${message.trackingUrl}" onclick="alert(1)`, message.trackingUrl.replace('#clave=', '?clave='),
    message.trackingUrl.replace('/q/seguimiento', '/other'), null, '']) {
    assert.equal(script.qmsMailValidMessage_({ ...message, trackingUrl }, true), false)
    assert.throws(() => script.qmsMailHtml_({ ...message, trackingUrl }))
  }
  assert.equal(appsScript({ QMS_PUBLIC_TRACKING_ORIGIN: undefined }).qmsMailValidMessage_(message, true), false)
  assert.equal(script.qmsMailValidMessage_({ ...message, kind: 'interno_recibido' }, true), false)
  const html = script.qmsMailHtml_({ ...message, body: `<script>alert(1)</script> & "prueba"` })
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script\b/)
})

test('receipt entero proyecta URL validada sin permitir que un segundo mensaje inválido empiece a enviar', async () => {
  const script = appsScript(), result = await claim([snapshot(), snapshot()])
  const receipt = { requestNonce: randomUUID(), leaseUntil: new Date(Date.now() + 60000).toISOString(), messages: result.receipt.messages }
  const parsed = script.qmsMailClaimReceipt_(receipt, 5)
  assert.equal(parsed.messages[0].message.trackingUrl, receipt.messages[0].trackingUrl)
  receipt.messages[1].trackingUrl = 'https://evil.example/q/seguimiento#clave=a.b'
  assert.throws(() => script.qmsMailClaimReceipt_(receipt, 5), /invalid_queue_receipt/)
})
