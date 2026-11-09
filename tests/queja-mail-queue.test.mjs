import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID, webcrypto } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const globals = { crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob }
const queue = loadModule('supabase/functions/quejas-mail-queue/index.ts', {}, globals)
const messages = loadModule('supabase/functions/quejas-mail-queue/message.ts', {}, globals)
const secret = 'synthetic-mailer-key-for-unit-tests-only'
const clock = 1_791_820_800_000
const seconds = Math.floor(clock / 1000)
const url = 'https://fixtureproject.supabase.co'
const snapshot = (overrides = {}) => ({ id: randomUUID(), claim_token: randomUUID(), tipo: 'final',
  destinatario: 'person@example.test', folio: '2026-001', estado: 'No Procede', numero_oficio: 'ECA-GC-2026-001', ...overrides })

function envelope(purpose, payload, overrides = {}) {
  const value = { version: 1, purpose, issuedAt: seconds, nonce: randomUUID(),
    payload: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url'), ...overrides }
  value.signature = createHmac('sha256', secret)
    .update(`eca-qms-mail:v1:${value.purpose}\n${value.issuedAt}\n${value.nonce}\n${value.payload}`).digest('hex')
  return value
}

function request(value, options = {}) {
  return new Request(`${url}/functions/v1/quejas-mail-queue`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers }, body: typeof value === 'string' ? value : JSON.stringify(value) })
}

async function receipt(response, purpose) {
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const value = await response.json()
  assert.equal(value.purpose, purpose)
  assert.equal(value.version, 1)
  assert.ok(messages.isMailUuid(value.nonce))
  const expected = createHmac('sha256', secret)
    .update(`eca-qms-mail:v1:${value.purpose}\n${value.issuedAt}\n${value.nonce}\n${value.payload}`).digest('hex')
  assert.equal(value.signature, expected)
  return JSON.parse(Buffer.from(value.payload, 'base64url').toString('utf8'))
}

function fixture(options = {}) {
  const envReads = [], calls = []
  const environment = { QUEJAS_MAIL_SIGNING_SECRET: secret, QUEJAS_MAIL_QUEUE_ENABLED: 'true',
    SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-for-tests', ...options.environment }
  const fetcher = async (target, init) => {
    const call = { url: String(target), ...init, args: init.body ? JSON.parse(init.body) : undefined }
    calls.push(call)
    if (options.transport) return options.transport(call)
    return Response.json(target.endsWith('/qms_mail_claim_batch_v2') ? options.rows ?? [] : options.ack ?? true)
  }
  const handler = queue.createQuejasMailQueueHandler({ env: key => { envReads.push(key); return environment[key] },
    fetcher, crypto: webcrypto, now: options.now ?? (() => clock) })
  return { handler, calls, envReads }
}

test('adjunto oficial opt-in solo sale del documento publicado tras autorizar el lease HMAC', async () => {
  const id = randomUUID(), claimToken = randomUUID(), caseId = randomUUID()
  const file = { queja_id: caseId, storage_path: 'synthetic_drive_official_001', nombre: 'Oficio.pdf', tipo_mime: 'application/pdf', tamano: 100 }
  for (const include of [undefined, false, true]) {
    const f = fixture({ transport: call => {
      if (call.method === 'POST') return Response.json(true)
      const url = new URL(call.url)
      if (url.pathname.endsWith('/queja_mail_outbox')) {
        assert.equal(url.searchParams.get('claim_token'), 'eq.' + claimToken)
        assert.equal(url.searchParams.get('status'), 'eq.leased')
        return Response.json([{ tipo: 'final', queja_id: caseId, lease_until: new Date(clock + 600000).toISOString(), queja: { estado: 'Finalizado' } }])
      }
      assert.equal(url.pathname, '/rest/v1/queja_public_resolutions')
      assert.equal(url.searchParams.get('queja_id'), 'eq.' + caseId)
      return Response.json([{ adjunto: file }])
    } })
    const result = await receipt(await f.handler(request(envelope('authorize_request', { eventId: id, claimToken,
      ...(include === undefined ? {} : { includeOfficialDocument: include }) }))), 'authorize_receipt')
    assert.equal(result.authorized, true)
    if (include) assert.deepEqual(result.officialDocument, { driveId: file.storage_path, name: file.nombre, mime: file.tipo_mime, size: file.tamano })
    else assert.equal(Object.hasOwn(result, 'officialDocument'), false)
    assert.equal(f.calls.length, include ? 2 : 1)
  }
})

test('adjunto no consulta archivos para lease denegado y rechaza metadata ajena/corrupta', async () => {
  const input = { eventId: randomUUID(), claimToken: randomUUID(), includeOfficialDocument: true }, caseId = randomUUID()
  const denied = fixture({ transport: () => Response.json([]) })
  const result = await receipt(await denied.handler(request(envelope('authorize_request', input))), 'authorize_receipt')
  assert.equal(result.authorized, false); assert.equal(denied.calls.length, 1)
  for (const patch of [{ queja_id: randomUUID() }, { tamano: 4194305 }, { storage_path: 'folder/private' }, { nombre: 'oficio\n.pdf' }, { tipo_mime: 'invalid' }]) {
    const f = fixture({ transport: call => call.method === 'POST' ? Response.json(true)
      : new URL(call.url).pathname.endsWith('/queja_mail_outbox') ? Response.json([{ tipo: 'final', queja_id: caseId, lease_until: new Date(clock + 600000).toISOString(), queja: { estado: 'Finalizado' } }])
        : Response.json([{ adjunto: { queja_id: caseId, storage_path: 'synthetic_private_file', nombre: 'Oficio.pdf', tipo_mime: 'application/pdf', tamano: 100, ...patch } }]) })
    const response = await f.handler(request(envelope('authorize_request', input)))
    assert.equal(response.status, 503)
    assert.doesNotMatch(await response.text(), /synthetic_private_file|Oficio\.pdf|service-role/)
  }
})

test('adjunto final no se autoriza con lease vencido, otro tipo o caso reabierto', async () => {
  const input = { eventId: randomUUID(), claimToken: randomUUID(), includeOfficialDocument: true }
  for (const patch of [{ lease_until: new Date(clock - 1).toISOString() }, { lease_until: 'invalid' },
    { tipo: 'recibido' }, { queja: { estado: 'En Investigación' } }, { queja: null }]) {
    const f = fixture({ transport: () => Response.json([{ tipo: 'final', queja_id: randomUUID(), lease_until: new Date(clock + 600000).toISOString(), queja: { estado: 'Finalizado' }, ...patch }]) })
    const result = await receipt(await f.handler(request(envelope('authorize_request', input))), 'authorize_receipt')
    assert.equal(result.authorized, false); assert.equal(result.officialDocument, null)
    assert.equal(f.calls.length, 1)
  }
})

test('claves modernas se quedan en Edge y usan apikey sin Authorization JWT', async () => {
  const f = fixture({ environment: { SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_synthetic_only' }) } })
  const result = await f.handler(request(envelope('claim_request', { limit: 1 })))
  assert.equal(result.status, 200)
  assert.equal(f.calls[0].headers.apikey, 'sb_secret_synthetic_only')
  assert.equal(f.calls[0].headers.Authorization, undefined)
  assert.equal(f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'), false)
  assert.doesNotMatch(await result.text(), /sb_secret_synthetic_only/)
})

test('diccionario moderno malformado no usa otra clave ni consulta la DB', async () => {
  for (const value of ['broken', 'null', '[]', JSON.stringify({ default: 7 }), JSON.stringify({ default: 'wrong-key' })]) {
    const f = fixture({ environment: { SUPABASE_SECRET_KEYS: value } })
    assert.equal((await f.handler(request(envelope('claim_request', { limit: 1 })))).status, 503)
    assert.equal(f.calls.length, 0)
    assert.equal(f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'), false)
  }
})

test('method y HMAC inválidos se rechazan antes de leer credenciales privilegiadas', async () => {
  const f = fixture()
  assert.equal((await f.handler(new Request(`${url}/functions/v1/quejas-mail-queue`))).status, 405)
  assert.deepEqual(f.envReads, [])
  const signed = envelope('claim_request', { limit: 1 })
  signed.signature = '0'.repeat(64)
  assert.equal((await f.handler(request(signed))).status, 401)
  assert.equal(f.calls.length, 0)
  assert.equal(f.envReads.some(key => key.startsWith('SUPABASE_')), false)
})

test('health firmado apagado verifica configuración sin leer DB, consumir nonce ni reclamar', async () => {
  const f = fixture({ environment: { QUEJAS_MAIL_QUEUE_ENABLED: 'false' } })
  const input = envelope('health_request', {})
  const result = await receipt(await f.handler(request(input)), 'health_receipt')
  assert.equal(result.requestNonce, input.nonce)
  assert.equal(result.enabled, false)
  assert.equal(f.calls.length, 0)
  assert.equal(f.envReads.some(key => key.startsWith('SUPABASE_')), false)
  assert.equal((await f.handler(request(input))).status, 200) // No efecto que pueda repetirse.
})

test('flags ausentes mantienen claim y ACK cerrados antes de credenciales/DB', async () => {
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    const f = fixture({ environment: { QUEJAS_MAIL_QUEUE_ENABLED: flag } })
    for (const input of [envelope('claim_request', { limit: 1 }),
      envelope('authorize_request', { eventId: randomUUID(), claimToken: randomUUID() }), envelope('ack_request', {
      eventId: randomUUID(), claimToken: randomUUID(), outcome: 'sent', code: 'sent', retryAfterSeconds: 300 })]) {
      assert.equal((await f.handler(request(input))).status, 503)
    }
    assert.equal(f.calls.length, 0)
    assert.equal(f.envReads.some(key => key.startsWith('SUPABASE_')), false)
  }
})

test('envelopes de legacy, firma cruzada, fechas, UUID y claves extras nunca llegan a DB', async () => {
  const invalid = [
    envelope('worker_request', { action: 'dispatch', limit: 1 }),
    envelope('delivery_request', {}),
    envelope('claim_receipt', {}),
    envelope('claim_request', { limit: 1 }, { issuedAt: seconds - 301 }),
    envelope('claim_request', { limit: 1 }, { issuedAt: seconds + 31 }),
    envelope('claim_request', { limit: 1 }, { issuedAt: seconds + .5 }),
    envelope('claim_request', { limit: 1 }, { nonce: 'not-a-uuid' }),
    { ...envelope('claim_request', { limit: 1 }), rpc: 'arbitrary_rpc' },
    { ...envelope('claim_request', { limit: 1 }), purpose: 'ack_request' },
  ]
  const f = fixture()
  for (const input of invalid) assert.equal((await f.handler(request(input))).status, 401)
  assert.equal(f.calls.length, 0)
  assert.equal(f.envReads.some(key => key.startsWith('SUPABASE_')), false)
})

test('request tiene límite real UTF8 y stream aunque content-length mienta', async () => {
  const f = fixture()
  for (const body of [' '.repeat(8_193), JSON.stringify({ data: 'é'.repeat(5_000) })]) {
    const result = await f.handler(request(body, { headers: { 'Content-Length': '2' } }))
    assert.equal(result.status, 413)
  }
  assert.equal((await f.handler(request('{}', { headers: { 'Content-Length': '8193' } }))).status, 413)
  assert.equal(f.calls.length, 0)
  assert.equal(f.envReads.some(key => key.startsWith('SUPABASE_')), false)
})

test('shape claim solo admite limit entero entre 0 y 5 y health solo objeto vacío', async () => {
  const f = fixture()
  for (const payload of [{}, { limit: -1 }, { limit: 6 }, { limit: 1.5 }, { limit: '1' },
    { limit: 1, to: 'attacker@example.test' }, { limit: 1, rpc: 'delete_all' }, [], null]) {
    assert.equal((await f.handler(request(envelope('claim_request', payload)))).status, 401)
  }
  assert.equal((await f.handler(request(envelope('health_request', { enabled: true })))).status, 401)
  assert.equal(f.calls.length, 0)
})

test('claim0 conserva el tick DB y exige respuesta vacía sin reservar entregas ni aceptar otro RPC', async () => {
  const f = fixture()
  const input = envelope('claim_request', { limit: 0 })
  const result = await receipt(await f.handler(request(input)), 'claim_receipt')
  assert.deepEqual(result.messages, [])
  assert.equal(result.requestNonce, input.nonce)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].url, `${url}/rest/v1/rpc/qms_mail_claim_batch_v2`)
  assert.deepEqual(f.calls[0].args, { p_limit: 0, p_lease_seconds: 600, p_run_nonce: input.nonce, p_issued_at: seconds })
  const unexpected = fixture({ rows: [snapshot()] })
  assert.equal((await unexpected.handler(request(envelope('claim_request', { limit: 0 })))).status, 503)
})

test('claim usa solo RPC fijo, nonce original, lease600 y servicio después de HMAC', async () => {
  const row = snapshot({ notas: 'DO_NOT_EXPOSE_INTERNAL_TEXT', extra: { private: true } })
  const f = fixture({ rows: [row] })
  const input = envelope('claim_request', { limit: 5 })
  const result = await receipt(await f.handler(request(input)), 'claim_receipt')
  assert.equal(result.requestNonce, input.nonce)
  assert.equal(result.leaseUntil, new Date(clock + 540_000).toISOString())
  assert.equal(result.messages.length, 1)
  assert.equal(result.messages[0].claimToken, row.claim_token)
  assert.equal(result.messages[0].eventId, row.id)
  assert.equal(result.messages[0].to, row.destinatario)
  assert.match(result.messages[0].body, /ECA-GC-2026-001/)
  assert.equal(JSON.stringify(result).includes('DO_NOT_EXPOSE_INTERNAL_TEXT'), false)
  assert.equal(f.calls.length, 1)
  const call = f.calls[0]
  assert.equal(call.url, `${url}/rest/v1/rpc/qms_mail_claim_batch_v2`)
  assert.equal(call.redirect, 'error')
  assert.equal(call.headers.Authorization, 'Bearer synthetic-service-role-for-tests')
  assert.deepEqual(call.args, { p_limit: 5, p_lease_seconds: 600, p_run_nonce: input.nonce, p_issued_at: seconds })
})

test('claim replay conserva nonce DB y no entrega un segundo lote reservado', async () => {
  const nonces = new Set(), row = snapshot()
  const f = fixture({ transport(call) {
    if (nonces.has(call.args.p_run_nonce)) return Response.json([])
    nonces.add(call.args.p_run_nonce)
    return Response.json([row])
  } })
  const input = envelope('claim_request', { limit: 1 })
  assert.equal((await receipt(await f.handler(request(input)), 'claim_receipt')).messages.length, 1)
  assert.equal((await receipt(await f.handler(request(input)), 'claim_receipt')).messages.length, 0)
  assert.equal(nonces.size, 1)
})

test('no devolver mensajes si snapshot inválido, duplicado, excesivo o RPC malformado', async () => {
  const row = snapshot()
  for (const rows of [[snapshot({ destinatario: 'a@example.test,b@example.test' })],
    [snapshot({ tipo: 'unknown' })], [snapshot({ claim_token: 'bad' })],
    [snapshot({ estado: 'Finalizado' })], [snapshot({ folio: '2026\nInjected' })],
    [row, row], [snapshot(), snapshot()], { rows: [row] }]) {
    const f = fixture({ rows })
    const result = await f.handler(request(envelope('claim_request', { limit: 1 })))
    assert.equal(result.status, 503)
    const error = await result.json()
    assert.deepEqual(error, { error: 'mail_queue_unavailable' })
    assert.equal(JSON.stringify(error).includes('@'), false)
  }
})

test('leaseUntil conservador sigue usando inicio HTTP aunque la DB tarde', async () => {
  let moment = clock
  const f = fixture({ now: () => moment, transport() { moment += 60_000; return Response.json([snapshot()]) } })
  const result = await receipt(await f.handler(request(envelope('claim_request', { limit: 1 }))), 'claim_receipt')
  assert.equal(result.leaseUntil, new Date(clock + 540_000).toISOString())
})

test('un transporte agotado no entrega un lease ya vencido al script', async () => {
  let moment = clock
  const f = fixture({ now: () => moment, transport() { moment += 540_001; return Response.json([snapshot()]) } })
  assert.equal((await f.handler(request(envelope('claim_request', { limit: 1 })))).status, 503)
})

test('ACK válido devuelve recibo firmado y nunca admite destinatario/contenido libre', async () => {
  const f = fixture()
  const payload = { eventId: randomUUID(), claimToken: randomUUID(), outcome: 'sent', code: 'sent', retryAfterSeconds: 300 }
  const input = envelope('ack_request', payload)
  const result = await receipt(await f.handler(request(input)), 'ack_receipt')
  assert.deepEqual(result, { requestNonce: input.nonce, eventId: payload.eventId, accepted: true })
  assert.equal(f.calls[0].url, `${url}/rest/v1/rpc/qms_mail_complete`)
  assert.deepEqual(f.calls[0].args, { p_id: payload.eventId, p_claim_token: payload.claimToken,
    p_outcome: 'sent', p_retry_delay_seconds: 300, p_safe_error: null })
  const forged = envelope('ack_request', { ...payload, to: 'attacker@example.test' })
  assert.equal((await f.handler(request(forged))).status, 401)
  assert.equal(f.calls.length, 1)
})

test('ACK outcome/código están vinculados y delay respeta límites SQL', async () => {
  const valid = { eventId: randomUUID(), claimToken: randomUUID(), outcome: 'retry', code: 'batch_not_started', retryAfterSeconds: 60 }
  const f = fixture()
  for (const patch of [{ outcome: 'delete' }, { outcome: '__proto__' }, { code: 'sent' },
    { outcome: 'skipped', code: 'sent' }, { outcome: 'sent', code: 'obsolete_notice' },
    { code: 'provider_private_message' }, { retryAfterSeconds: 59 }, { retryAfterSeconds: 86401 },
    { retryAfterSeconds: 60.5 }, { retryAfterSeconds: '60' }, { eventId: 'bad' }, { claimToken: 'bad' }]) {
    assert.equal((await f.handler(request(envelope('ack_request', { ...valid, ...patch })))).status, 401)
  }
  for (const [outcome, code] of [['retry', 'quota_exhausted'], ['retry', 'ledger_busy'],
    ['retry', 'ledger_unavailable'], ['retry', 'disabled'], ['retry', 'batch_not_started'], ['retry', 'authorization_unavailable'],
    ['uncertain', 'delivery_uncertain'], ['failed', 'event_conflict'], ['failed', 'invalid_delivery'],
    ['failed', 'invalid_mail_snapshot'], ['sent', 'already_sent'], ['skipped', 'obsolete_notice']]) {
    const result = await receipt(await f.handler(request(envelope('ack_request', { ...valid, outcome, code, retryAfterSeconds: 86400 }))), 'ack_receipt')
    assert.equal(result.accepted, true)
  }
})

test('ACK token ajeno/vencido y replay dejan CASfalse explícito sin reenvío', async () => {
  const id = randomUUID(), token = randomUUID()
  let completed = false
  const f = fixture({ transport(call) {
    const valid = !completed && call.args.p_id === id && call.args.p_claim_token === token
    if (valid) completed = true
    return Response.json(valid)
  } })
  const ack = { eventId: id, claimToken: token, outcome: 'sent', code: 'sent', retryAfterSeconds: 300 }
  assert.equal((await receipt(await f.handler(request(envelope('ack_request', { ...ack, claimToken: randomUUID() }))), 'ack_receipt')).accepted, false)
  const input = envelope('ack_request', ack)
  assert.equal((await receipt(await f.handler(request(input)), 'ack_receipt')).accepted, true)
  assert.equal((await receipt(await f.handler(request(input)), 'ack_receipt')).accepted, false)
  assert.equal(f.calls.every(call => call.url.endsWith('/qms_mail_complete')), true)
})

test('respuesta RPC ACK exige booleano y sanitiza fallos, errores y redirects', async () => {
  const ack = envelope('ack_request', { eventId: randomUUID(), claimToken: randomUUID(), outcome: 'sent', code: 'sent', retryAfterSeconds: 300 })
  for (const transport of [() => Response.json({ accepted: true }),
    () => Response.json({ error: 'secret-person@example.test' }, { status: 500 }),
    () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }),
    () => { throw new Error('secret-person@example.test') }]) {
    const f = fixture({ transport })
    const result = await f.handler(request(ack))
    assert.equal(result.status, 503)
    assert.deepEqual(await result.json(), { error: 'mail_queue_unavailable' })
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].redirect, 'error')
  }
})

test('JSON upstream realmente limitado aun con header falso o stream fragmentado', async () => {
  const huge = new TextEncoder().encode(' '.repeat(65537))
  const transport = () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(huge.subarray(0, 30000)); controller.enqueue(huge.subarray(30000)); controller.close()
  } }), { headers: { 'Content-Type': 'application/json', 'Content-Length': '2' } })
  const f = fixture({ transport })
  const result = await f.handler(request(envelope('claim_request', { limit: 1 })))
  assert.equal(result.status, 503)
  assert.deepEqual(await result.json(), { error: 'mail_queue_unavailable' })
})

test('secret mínimo y URL DB segura evitan efectos o envío de credenciales a otro host', async () => {
  const input = envelope('claim_request', { limit: 1 })
  for (const badUrl of ['http://fixtureproject.supabase.co', 'https://evil.example',
    'https://fixtureproject.supabase.co:444', 'https://fixtureproject.supabase.co?leak=1',
    'https://user:password@fixtureproject.supabase.co', 'https://fixtureproject.supabase.co/arbitrary']) {
    const f = fixture({ environment: { SUPABASE_URL: badUrl } })
    assert.equal((await f.handler(request(input))).status, 503)
    assert.equal(f.calls.length, 0)
  }
  for (const key of [undefined, '', 'short']) {
    const f = fixture({ environment: { QUEJAS_MAIL_SIGNING_SECRET: key } })
    assert.equal((await f.handler(request(input))).status, 503)
    assert.equal(f.calls.length, 0)
    assert.equal(f.envReads.some(name => name.startsWith('SUPABASE_')), false)
  }
})

test('plantillas canónicas usan exclusivamente los campos públicos del snapshot', () => {
  for (const tipo of ['recibido', 'final']) {
    const row = messages.claimMailSnapshot(snapshot({ tipo, notas: 'INTERNAL_SECRET', observaciones: 'INTERNAL_SECRET' }))
    const message = messages.quejaMailMessage(row)
    assert.equal(message.kind, tipo)
    assert.equal(message.folio, '2026-001')
    assert.equal(JSON.stringify(message).includes('INTERNAL_SECRET'), false)
    assert.equal(message.subject.length <= 180, true)
    assert.equal(message.body.length <= 6000, true)
  }
})

test('el hito ciudadano de investigación retirado se rechaza sin producir un lote ni mensaje enviable', async () => {
  const retired = snapshot({ tipo: 'investigacion', estado: 'En Investigación' })
  assert.throws(() => messages.claimMailSnapshot(retired), /invalid_mail_snapshot/)
  assert.throws(() => messages.claimMailSnapshot(retired, { internal: true }), /invalid_mail_snapshot/)
  assert.throws(() => messages.quejaMailMessage(retired), /invalid_mail_snapshot/)
  const f = fixture({ rows: [snapshot({ tipo: 'recibido' }), retired] })
  const response = await f.handler(request(envelope('claim_request', { limit: 2 })))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'mail_queue_unavailable' })
  assert.equal(f.calls.length, 1, 'solo reclama: no confirma ni autoriza una entrega retirada')
})

test('firma Web Crypto interoperable con Node y recepción conserva payload canónico', async () => {
  const value = await queue.signQueueEnvelope('health_request', {}, secret, webcrypto, clock)
  const expected = createHmac('sha256', secret)
    .update(`eca-qms-mail:v1:${value.purpose}\n${value.issuedAt}\n${value.nonce}\n${value.payload}`).digest('hex')
  assert.equal(value.signature, expected)
  const f = fixture()
  assert.equal((await receipt(await f.handler(request(value)), 'health_receipt')).enabled, true)
})

test('avisos internos optan por contrato v2 y conservan exactamente el snapshot mínimo', async () => {
  for (const tipo of messages.INTERNAL_MAIL_KINDS) {
    const raw = snapshot({ tipo, notas: 'PRIVATE_ANALYSIS', email_cliente: 'private@example.test',
      estado: 'PRIVATE_STATE', numero_oficio: 'PRIVATE_OFFICE', expires_at: 'PRIVATE_DATE' })
    assert.throws(() => messages.claimMailSnapshot(raw), /invalid_mail_snapshot/, 'legacy ciudadano no opta por internos')
    const row = messages.claimMailSnapshot(raw, { internal: true })
    assert.deepEqual(Object.keys(row).sort(), ['id', 'claim_token', 'tipo', 'destinatario', 'folio', 'estado', 'numero_oficio'].sort())
    const message = messages.quejaMailMessage(row)
    assert.equal(message.kind, tipo)
    assert.match(message.subject, /Queja 2026-001/)
    assert.ok(message.subject.length <= 180 && message.body.length <= 6000)
    assert.doesNotMatch(JSON.stringify(message), /PRIVATE_|private@example|expires_at|notas/)
    const f = fixture({ rows: [raw] })
    const result = await receipt(await f.handler(request(envelope('claim_request', { limit: 1 }))), 'claim_receipt')
    assert.deepEqual(result.messages[0], { ...message, claimToken: raw.claim_token })
    assert.equal(f.calls[0].url, `${url}/rest/v1/rpc/qms_mail_claim_batch_v2`)
  }
})

test('mensajes internos fijan el hito y no calculan fechas ni admiten otros tipos', () => {
  const expected = { interno_recibido: /3 días hábiles/, interno_evaluacion_1: /1 día hábil/,
    interno_asignacion: /15 días hábiles desde la decisión/, interno_investigacion_5: /5 días hábiles/,
    interno_investigacion_3: /3 días hábiles/, interno_evaluacion_vencida: /evaluación.*venció/,
    interno_investigacion_vencida: /investigación.*venció/ }
  for (const [tipo, text] of Object.entries(expected)) {
    const row = messages.claimMailSnapshot(snapshot({ tipo }), { internal: true })
    assert.match(messages.quejaMailMessage(row).body, text)
  }
  assert.throws(() => messages.claimMailSnapshot(snapshot({ tipo: 'interno_arbitrary' }), { internal: true }))
})

test('authorize solo usa el RPC fijo y devuelve booleano firmado correlacionado sin datos extra', async () => {
  for (const authorized of [true, false]) {
    const f = fixture({ ack: authorized })
    const payload = { eventId: randomUUID(), claimToken: randomUUID() }
    const input = envelope('authorize_request', payload)
    const result = await receipt(await f.handler(request(input)), 'authorize_receipt')
    assert.deepEqual(result, { requestNonce: input.nonce, eventId: payload.eventId, authorized })
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].url, `${url}/rest/v1/rpc/qms_mail_authorize`)
    assert.deepEqual(f.calls[0].args, { p_id: payload.eventId, p_claim_token: payload.claimToken })
    assert.equal(f.calls[0].redirect, 'error')
  }
})

test('authorize malformado o no autenticado se rechaza antes de leer credenciales DB', async () => {
  const payload = { eventId: randomUUID(), claimToken: randomUUID() }
  for (const invalid of [{}, { ...payload, eventId: 'invalid' }, { ...payload, claimToken: null },
    { ...payload, recipient: 'controlled@example.test' }, { ...payload, rpc: 'arbitrary' },
    { ...payload, kind: 'interno_recibido' }, [], null]) {
    const f = fixture()
    assert.equal((await f.handler(request(envelope('authorize_request', invalid)))).status, 401)
    assert.equal(f.calls.length, 0)
    assert.equal(f.envReads.some(key => key.startsWith('SUPABASE_')), false)
  }
  const f = fixture()
  const invalid = { ...envelope('authorize_request', payload), signature: '0'.repeat(64) }
  assert.equal((await f.handler(request(invalid))).status, 401)
  assert.equal(f.calls.length, 0)
})

test('authorize no traduce un fallo de DB o respuesta no booleana a permiso para enviar', async () => {
  const payload = { eventId: randomUUID(), claimToken: randomUUID() }
  for (const transport of [() => Response.json({ authorized: true }), () => Response.json('true'),
    () => Response.json(null), () => Response.json({ error: 'private@example.test' }, { status: 500 }),
    () => { throw Error('private@example.test') }]) {
    const f = fixture({ transport })
    const response = await f.handler(request(envelope('authorize_request', payload)))
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'mail_queue_unavailable' })
    assert.equal(f.calls.length, 1)
  }
})

test('Deno registra el handler sin consultar secretos ni hacer red al importar', () => {
  let handler, reads = 0
  loadModule('supabase/functions/quejas-mail-queue/index.ts', {}, { ...globals,
    Deno: { env: { get() { reads++; throw new Error('must not read on import') } }, serve(value) { handler = value } } })
  assert.equal(typeof handler, 'function')
  assert.equal(reads, 0)
})
