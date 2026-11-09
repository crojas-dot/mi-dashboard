import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { checkBotId } from 'botid/server'
import { loadModule } from './load-module.mjs'

const SECRET = 'synthetic-public-gateway-signing-secret-0000'
const NOW = 1791489600000
const FORM = '12345678-1234-4234-8234-123456789abc'
const SUBMISSION = '22345678-1234-4234-8234-123456789abc'
const QUEJA = '32345678-1234-4234-8234-123456789abc'
const UPLOAD = '42345678-1234-4234-8234-123456789abc'
const RESERVATION = '52345678-1234-4234-8234-123456789abc'
const ADJUNTO = '62345678-1234-4234-8234-123456789abc'
const OTHER = '72345678-1234-4234-8234-123456789abc'
const TOKEN = '12345678123442348234123456789abc'
const FILE_ID = 'synthetic-drive-file'
const FOLIO = 'Q-SYNTHETIC-001'
const PII = 'SYNTHETIC_PERSON_PRIVATE_DATA'
const DRAFT = { formToken: TOKEN, submissionId: SUBMISSION, honeypot: '', nombre: ' Persona sintética ', email: ' Persona@Example.TEST ', telefono: '', categoria: 'Queja', descripcion: ' Descripción sintética. ' }
const capabilities = loadModule('lib/server/publicForms/uploadCapability.ts')
const validation = loadModule('lib/server/publicForms/validation.ts')
const { assertPrivateDriveFolder } = loadModule('lib/server/drive.ts')
const VALID_PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Root 1 0 R /Size 4 >>\nstartxref\n186\n%%EOF\n')
class FixedDate extends Date { static now() { return NOW } }
const cap = (claims = {}, issuedAt = Math.floor(NOW / 1000)) => capabilities.issueUploadCapability({ formId: FORM, submissionId: SUBMISSION, quejaId: QUEJA, issuedAt, ...claims }, SECRET, NOW).uploadToken
const jsonRequest = (path, body, headers = {}) => new Request('https://app.example.test' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.42', ...headers }, body: JSON.stringify(body) })
function uploadRequest({ uploadToken = cap(), uploadId = UPLOAD, extra = {}, file = new File([VALID_PDF], '../../evidencia.pdf', { type: 'application/pdf' }) } = {}) {
  const form = new FormData()
  form.set('file', file); form.set('uploadToken', uploadToken); form.set('uploadId', uploadId)
  for (const [key, value] of Object.entries(extra)) form.set(key, value)
  return new Request('https://app.example.test/api/drive/upload-public', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.42' }, body: form })
}
function fixture(options = {}) {
  const calls = [], logs = []
  const state = { created: false, reservation: { reservation_id: RESERVATION, status: 'reserved', created: true, adjunto_id: null, storage_path: null, ...options.reservation } }
  const rpcCalls = name => calls.filter(call => call.type === 'rpc' && (!name || call.resource === name))
  const sdk = createClient('https://synthetic-supabase.example.test', 'synthetic-service-credential', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      const parsed = new URL(url)
      const rpc = parsed.pathname.includes('/rpc/')
      const resource = parsed.pathname.split('/').pop()
      const args = init.body ? JSON.parse(init.body) : null
      const call = { type: rpc ? 'rpc' : 'read', resource, args, query: parsed.searchParams, method: init.method }
      calls.push(call)
      let data, outcome
      if (rpc && options.rpc?.[resource]) outcome = await options.rpc[resource](args, rpcCalls(resource).length, state)
      if (!rpc && options.read?.[resource]) outcome = await options.read[resource](call, state)
      if (outcome?.error) return Response.json(outcome.error, { status: outcome.status ?? 400 })
      if (outcome && Object.hasOwn(outcome, 'data')) data = outcome.data
      else if (rpc) {
        if (resource === 'public_form_consume_rate') data = { allowed: true, retry_after: 0 }
        else if (resource === 'public_form_create_submission') {
          data = { queja_id: QUEJA, folio: FOLIO, created_at: new Date(NOW - 60_000).toISOString(), created: !state.created, finalized: false }
          state.created = true
        } else if (resource === 'public_form_reserve_upload') data = { ...state.reservation, created: state.reservation.status === 'reserved' && !state.reserved }
        else if (resource === 'public_form_commit_upload') {
          if (!/^drive:[A-Za-z0-9_-]+$/.test(args.p_storage_path)) return Response.json({ code: '22023', message: 'PUBLIC_UPLOAD_PATH_INVALID' }, { status: 400 })
          state.reservation = { ...state.reservation, status: 'committed', storage_path: args.p_storage_path, adjunto_id: ADJUNTO }
          data = { adjunto_id: ADJUNTO, storage_path: args.p_storage_path, committed: true }
        } else if (resource === 'public_form_release_upload') { state.reservation.status = 'released'; data = true }
        else if (resource === 'public_form_finalize_submission') data = { folio: FOLIO, finalized: true }
        else throw new Error('Unexpected RPC ' + resource)
      } else if (resource === 'formularios_publicos') data = { id: FORM, nombre: 'Formulario sintético', modulo: 'quejas', private: PII }
      else if (resource === 'configuraciones_sistema') data = { valor: 'synthetic-private-root' }
      else if (resource === 'quejas') data = { folio: FOLIO }
      else throw new Error('Unexpected table ' + resource)
      if (resource === 'public_form_reserve_upload') state.reserved = true
      const single = new Headers(init.headers).get('accept')?.includes('vnd.pgrst.object+json')
      return Response.json(rpc || single ? data : data === null ? [] : [data])
    } },
  })
  const drive = {
    permissions: { list: async params => {
      calls.push({ type: 'drive-permissions', params })
      if (options.permissionsError) throw options.permissionsError
      const page = options.permissionPages?.[params.fileId]?.[params.pageToken ?? 'first']
      return { data: page ?? { permissions: options.permissions ?? [{ type: 'user' }] } }
    } },
    files: { delete: async params => { calls.push({ type: 'drive-delete', params }); if (options.deleteError) throw options.deleteError; return {} } },
  }
  const mocks = {
    'next/server': { after: callback => { if (options.afterError) throw new Error('synthetic after failure'); calls.push({ type: 'mail-wake-scheduled', callback }) } },
    '@/lib/server/quejaMailWake': { wakeQuejaMail: async () => { calls.push({ type: 'mail-wake' }); return true } },
    'botid/server': { checkBotId: async opts => { calls.push({ type: 'bot', opts }); if (options.botError) throw options.botError; return options.bot ?? { isHuman: true, isBot: false, isVerifiedBot: false } } },
    '@/lib/server/supabase-admin': { createServiceClient: () => { calls.push({ type: 'service' }); return options.noBackend ? null : sdk } },
    '@/lib/server/drive': {
      assertPrivateDriveFolder,
      eliminarArchivoDrive: async fileId => { calls.push({ type: 'drive-delete', params: { fileId } }); return !options.deleteError },
      getDriveClient: () => { calls.push({ type: 'drive-client' }); return options.noDrive ? null : drive },
      buscarOCrearSubcarpeta: async (_drive, root, name) => { calls.push({ type: 'drive-folder', root, name }); if (options.folderError) throw options.folderError; return 'synthetic-private-subfolder' },
      subirArchivoASubcarpeta: async (folder, file) => { calls.push({ type: 'drive-upload', folder, file }); if (options.uploadError) throw options.uploadError; return { id: FILE_ID } },
    },
    '@/lib/server/driveContext': { programarContextoDrive: folder => calls.push({ type: 'drive-context', folder }) },
  }
  const globals = { process: { env: { NODE_ENV: 'production', VERCEL: '1', PUBLIC_FORMS_SIGNING_SECRET: SECRET, ...options.env } }, Date: FixedDate, console: { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) } }
  return {
    calls, logs, state, rpcCalls,
    get driveCalls() { return calls.filter(call => call.type.startsWith('drive-')) },
    get effects() { return calls.filter(call => call.type !== 'bot') },
    submit: loadModule('app/api/public/quejas/route.ts', mocks, globals).POST,
    upload: loadModule('app/api/drive/upload-public/route.ts', mocks, globals).POST,
    finalize: loadModule('app/api/public/quejas/finalizar/route.ts', mocks, globals).POST,
    metadata: loadModule('app/api/public/formularios/[token]/route.ts', mocks, globals).GET,
  }
}

// SDK Supabase real; BotID/Drive y sus errores permanecen sintéticos.
test('producción exige resultado humano completo y no permite bots de ninguna clase', async () => {
  const cases = [
    [{ bot: { isHuman: false, isBot: true } }, 403],
    [{ bot: { isHuman: true, isBot: false, isVerifiedBot: true } }, 403],
    [{ bot: { isHuman: false, isBot: false } }, 403],
    [{ bot: { isHuman: true } }, 503],
    [{ botError: new Error('SDK unavailable fixture') }, 503],
  ]
  for (const [options, status] of cases) for (const method of ['submit', 'upload', 'finalize']) {
    const f = fixture(options)
    const request = method === 'upload' ? uploadRequest() : jsonRequest('/api/public/quejas', method === 'finalize' ? { uploadToken: cap() } : DRAFT)
    assert.equal((await f[method](request)).status, status)
    assert.equal(f.effects.length, 0)
    assert.equal(f.calls[0].opts.advancedOptions.checkLevel, 'basic')
    assert.equal(f.calls[0].opts.developmentOptions.isDevelopment, false)
  }
  const human = fixture({ env: { PUBLIC_FORMS_LOCAL_TESTING: 'true' } })
  assert.equal((await human.submit(jsonRequest('/api/public/quejas', DRAFT))).status, 201)
  assert.equal(human.calls.some(call => call.type === 'bot'), true)
})

test('modo local explícito solo permite loopback; no abre el formulario fuera de Vercel', async () => {
  const local = fixture({ env: { VERCEL: undefined, PUBLIC_FORMS_LOCAL_TESTING: 'true' } })
  const request = new Request('http://127.0.0.1/api/public/quejas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' }, body: JSON.stringify(DRAFT) })
  assert.equal((await local.submit(request)).status, 201)
  assert.equal(local.calls.some(call => call.type === 'bot'), false)
  for (const env of [{ VERCEL: undefined }, { VERCEL: undefined, PUBLIC_FORMS_LOCAL_TESTING: 'true' }]) {
    const external = fixture({ env })
    assert.equal((await external.submit(jsonRequest('/api/public/quejas', DRAFT))).status, 503)
    assert.equal(external.effects.length, 0)
  }
})

test('secreto inválido e interruptor de emergencia cierran todas las rutas sin efectos', async () => {
  for (const env of [{ PUBLIC_FORMS_SIGNING_SECRET: undefined }, { PUBLIC_FORMS_SIGNING_SECRET: 'short' }, { PUBLIC_FORMS_ENABLED: 'false' }, { PUBLIC_FORMS_ENABLED: 'TRUE' }]) {
    const f = fixture({ env })
    assert.equal((await f.submit(jsonRequest('/api/public/quejas', DRAFT))).status, 503)
    assert.equal((await f.upload(uploadRequest())).status, 503)
    assert.equal((await f.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: cap() }))).status, 503)
    assert.equal((await f.metadata(new Request('https://app.example.test/api/public/formularios/' + TOKEN), { params: Promise.resolve({ token: TOKEN }) })).status, 503)
    assert.equal(f.calls.length, 0)
  }
})

test('campos administrativos y honeypot se rechazan antes de cliente privilegiado', async () => {
  for (const extra of [{ estado: 'Cerrado' }, { responsable_id: OTHER }, { formId: OTHER }, { quejaId: OTHER }, { folio: 'arbitrary' }, { prioridad: 'Alta' }, { workflow_revision: 50 }, { honeypot: 'robot' }]) {
    const f = fixture()
    const response = await f.submit(jsonRequest('/api/public/quejas', { ...DRAFT, ...extra }))
    assert.equal(response.status, Object.hasOwn(extra, 'honeypot') ? 403 : 400)
    assert.equal(f.effects.length, 0)
  }
})

test('correo obligatorio rechaza solicitudes directas antes de DB, folio o Drive', async () => {
  for (const email of [undefined, null, '', '   ', 'sin-arroba']) {
    const f = fixture()
    const response = await f.submit(jsonRequest('/api/public/quejas', { ...DRAFT, email }))
    assert.equal(response.status, 400)
    assert.deepEqual(f.calls.map(call => call.type), ['bot'])
    assert.equal(f.effects.length, 0)
  }
})

test('mismo envío recupera el folio oficial y capacidad firmada con los IDs persistidos', async () => {
  const f = fixture()
  const first = await f.submit(jsonRequest('/api/public/quejas', DRAFT))
  const replay = await f.submit(jsonRequest('/api/public/quejas', DRAFT))
  assert.equal(first.status, 201); assert.equal(replay.status, 200)
  const a = await first.json(), b = await replay.json()
  assert.equal(a.folio, FOLIO); assert.equal(b.folio, a.folio); assert.equal(a.quejaId, QUEJA); assert.equal(b.uploadToken, a.uploadToken)
  const claims = capabilities.verifyUploadCapability(a.uploadToken, SECRET, NOW)
  assert.equal(claims.formId, FORM); assert.equal(claims.submissionId, SUBMISSION); assert.equal(claims.quejaId, QUEJA)
  const args = f.rpcCalls('public_form_create_submission')[0].args
  assert.deepEqual(Object.keys(args).sort(), ['p_form_id','p_form_token','p_submission_id','p_payload_hash','p_rate_key_hash','p_cliente_nombre','p_email_cliente','p_telefono','p_categoria','p_descripcion'].sort())
  assert.equal(args.p_cliente_nombre, 'Persona sintética'); assert.equal(args.p_email_cliente, 'persona@example.test')
  assert.equal(args.p_form_id, FORM); assert.equal(args.p_form_token, TOKEN); assert.equal(args.p_submission_id, SUBMISSION)
  assert.equal(args.p_payload_hash, validation.hashPublicPayload(FORM, validation.validatePublicSubmission(DRAFT)))
  assert.match(args.p_rate_key_hash, /^[0-9a-f]{64}$/)
  assert.equal(f.calls.some(call => call.resource === 'crear_queja_publica'), false)
  const read = f.calls.find(call => call.resource === 'formularios_publicos')
  assert.equal(read.query.get('token'), 'eq.' + TOKEN); assert.equal(read.query.get('activo'), 'eq.true'); assert.equal(read.query.get('modulo'), 'eq.quejas')
  assert.equal(first.headers.get('cache-control'), 'no-store'); assert.equal(replay.headers.get('x-content-type-options'), 'nosniff')
})

test('el reloj de DB adelantado no convierte un alta confirmada en error de datos ni impide finalizar', async () => {
  let registrations = 0
  const f = fixture({ rpc: { public_form_create_submission: (_args, _attempt, state) => {
    const created = !state.created
    if (created) registrations++
    state.created = true
    return { data: { queja_id: QUEJA, folio: FOLIO, created_at: new Date(NOW + 30_000).toISOString(), created, finalized: false } }
  } } })
  const draft = { ...DRAFT, descripcion: 'Lorem ipsum dolor sit amet.\n'.repeat(400).slice(0, 10_000) }
  for (const status of [201, 200, 200]) {
    const response = await f.submit(jsonRequest('/api/public/quejas', draft))
    assert.equal(response.status, status)
    const result = await response.json()
    const claims = capabilities.verifyUploadCapability(result.uploadToken, SECRET, NOW)
    assert.equal(result.folio, FOLIO)
    assert.equal(claims.iat, Math.floor(NOW / 1000))
    assert.equal(claims.submissionId, SUBMISSION)
    assert.equal(claims.quejaId, QUEJA)
    assert.equal((await f.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: result.uploadToken }))).status, 200)
  }
  assert.equal(registrations, 1)
  assert.equal(f.rpcCalls('public_form_finalize_submission').length, 3)
  assert.equal(new Set(f.rpcCalls('public_form_create_submission').map(call => call.args.p_payload_hash)).size, 1)
})

test('un recibo RPC inválido después de commit es indisponibilidad y nunca rechazo del borrador', async () => {
  for (const change of [{ queja_id: 'invalid-id' }, { folio: '' }, { created_at: 'invalid-date' }, { created: 'yes' }]) {
    const f = fixture({ rpc: { public_form_create_submission: (_args, _attempt, state) => {
      state.created = true
      return { data: { queja_id: QUEJA, folio: FOLIO, created_at: new Date(NOW).toISOString(), created: true, finalized: false, ...change } }
    } } })
    const response = await f.submit(jsonRequest('/api/public/quejas', DRAFT))
    assert.equal(f.state.created, true)
    assert.equal(response.status, 503)
    assert.equal((await response.json()).code, 'public_forms_unavailable')
  }
})

test('recuperación antigua revalida el mismo RPC antes de emitir capacidad vigente', async () => {
  const f = fixture({ rpc: { public_form_create_submission: () => ({ data: { queja_id: QUEJA, folio: FOLIO, created: false, created_at: new Date(NOW - 3_600_000).toISOString() } }) } })
  const response = await f.submit(jsonRequest('/api/public/quejas', DRAFT))
  assert.equal(response.status, 200)
  const claims = capabilities.verifyUploadCapability((await response.json()).uploadToken, SECRET, NOW)
  assert.equal(claims.iat, NOW / 1000); assert.equal(f.rpcCalls('public_form_create_submission').length, 1)
})

test('cuota por IP precede búsqueda y creación; el cliente no controla la clave', async () => {
  const f = fixture({ rpc: { public_form_consume_rate: () => ({ data: { allowed: false, retry_after: 42 } }) } })
  const response = await f.submit(jsonRequest('/api/public/quejas', DRAFT))
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '42')
  assert.equal(f.calls.some(call => call.type === 'read'), false)
  assert.equal(f.rpcCalls('public_form_create_submission').length, 0)
  const args = f.rpcCalls()[0].args
  assert.equal(args.p_operation, 'attempt'); assert.equal(args.p_limit, 10); assert.equal(args.p_window_seconds, 900)
  assert.equal(args.p_key_hash, capabilities.hashPublicRateKey('203.0.113.42', SECRET))
})

test('IP de plataforma ausente o inválida en producción no consulta DB ni Drive', async () => {
  for (const ip of ['', 'attacker-controlled', '999.1.1.1']) {
    const f = fixture()
    assert.equal((await f.submit(jsonRequest('/api/public/quejas', DRAFT, { 'x-forwarded-for': ip }))).status, 503)
    assert.equal(f.rpcCalls().length, 0); assert.equal(f.calls.some(call => call.type === 'read'), false)
  }
})

test('metadata solo publica nombre/módulo del formulario activo de Quejas', async () => {
  const f = fixture()
  const response = await f.metadata(new Request('https://app.example.test/api/public/formularios/' + TOKEN), { params: Promise.resolve({ token: TOKEN }) })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { nombre: 'Formulario sintético', modulo: 'quejas', uploadsAllowed: true })
  const read = f.calls.find(call => call.type === 'read')
  assert.equal(read.query.get('select'), 'nombre,modulo'); assert.equal(read.query.get('activo'), 'eq.true'); assert.equal(read.query.get('modulo'), 'eq.quejas')
  const missing = fixture({ read: { formularios_publicos: () => ({ data: null }) } })
  assert.equal((await missing.metadata(new Request('https://app.example.test'), { params: Promise.resolve({ token: TOKEN }) })).status, 404)
  const invalid = fixture()
  assert.equal((await invalid.metadata(new Request('https://app.example.test'), { params: Promise.resolve({ token: FORM }) })).status, 400)
  assert.equal(invalid.calls.length, 0)
})

test('capacidades alteradas y expiradas fallan antes de backend, cuota y Drive', async () => {
  const original = cap()
  const [header, payload, signature] = original.split('.')
  const changed = Buffer.from(JSON.stringify({ ...capabilities.verifyUploadCapability(original, SECRET, NOW), quejaId: OTHER })).toString('base64url')
  for (const [uploadToken, status] of [[header + '.' + changed + '.' + signature, 403], [cap({}, NOW / 1000 - 1800), 410], ['broken.capability', 403]]) {
    const f = fixture()
    assert.equal((await f.upload(uploadRequest({ uploadToken }))).status, status)
    assert.equal(f.effects.length, 0)
  }
  assert.ok(payload)
})

test('multipart no admite IDs, folio o token legacy elegidos por cliente', async () => {
  for (const extra of [{ quejaId: OTHER }, { folio: 'arbitrary' }, { formId: OTHER }, { token: TOKEN }, { submissionId: OTHER }]) {
    const f = fixture()
    assert.equal((await f.upload(uploadRequest({ extra }))).status, 400); assert.equal(f.effects.length, 0)
  }
})

test('subida usa solo IDs firmados, bytes verificados, hash y ruta Drive persistible', async () => {
  const f = fixture()
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 200)
  const reserve = f.rpcCalls('public_form_reserve_upload')[0].args
  assert.deepEqual(reserve, { p_form_id: FORM, p_submission_id: SUBMISSION, p_queja_id: QUEJA, p_upload_id: UPLOAD, p_content_hash: createHash('sha256').update(VALID_PDF).digest('hex'), p_nombre: 'evidencia.pdf', p_tipo_mime: 'application/pdf', p_tamano: VALID_PDF.length })
  const commit = f.rpcCalls('public_form_commit_upload')[0].args
  assert.equal(commit.p_storage_path, 'drive:' + FILE_ID); assert.equal(commit.p_reservation_id, RESERVATION)
  const upload = f.calls.find(call => call.type === 'drive-upload')
  assert.equal(upload.file.nombre, UPLOAD + '.pdf'); assert.ok(upload.file.buffer.equals(VALID_PDF))
  assert.equal(f.calls.find(call => call.type === 'drive-folder').name, FOLIO)
  assert.equal((await response.json()).drive_file_id, FILE_ID)
  assert.equal(f.calls.some(call => call.type === 'drive-context'), true)
  assert.equal(f.calls.findIndex(call => call.resource === 'public_form_consume_rate') < f.calls.findIndex(call => call.type === 'drive-permissions'), true)
})

test('cuota de intentos de subida impide incluso configuración, formato y Drive', async () => {
  const f = fixture({ rpc: { public_form_consume_rate: () => ({ data: { allowed: false, retry_after: 99 } }) } })
  const response = await f.upload(uploadRequest({ file: new File(['invalid'], 'evidencia.pdf', { type: 'application/pdf' }) }))
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '99')
  assert.equal(f.driveCalls.length, 0); assert.equal(f.calls.some(call => call.type === 'read'), false)
  assert.equal(f.rpcCalls()[0].args.p_operation, 'upload'); assert.equal(f.rpcCalls()[0].args.p_limit, 30)
})

test('capacidad válida ajena a la reclamación falla en DB antes de cualquier llamada Drive', async () => {
  const f = fixture({ rpc: { public_form_reserve_upload: () => ({ error: { code: '42501', message: 'PUBLIC_SUBMISSION_UNAVAILABLE' } }) } })
  assert.equal((await f.upload(uploadRequest({ uploadToken: cap({ formId: OTHER }) }))).status, 403)
  assert.equal(f.rpcCalls('public_form_reserve_upload')[0].args.p_form_id, OTHER)
  assert.equal(f.driveCalls.length, 0)
})

test('cuota de cantidad o bytes rechaza la reserva antes de Drive', async () => {
  const f = fixture({ rpc: { public_form_reserve_upload: () => ({ error: { code: '54000', message: 'PUBLIC_UPLOAD_QUOTA' } }) } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'public_upload_quota')
  assert.equal(f.driveCalls.length, 0); assert.equal(f.rpcCalls('public_form_release_upload').length, 0)
})

test('reintento confirmado recupera recibo sin configuración ni ninguna llamada Drive', async () => {
  const f = fixture({ reservation: { status: 'committed', created: false, adjunto_id: ADJUNTO, storage_path: 'drive:' + FILE_ID }, noDrive: true, read: { configuraciones_sistema: () => { throw new Error('Configuration must not be read') } } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 200)
  const receipt = await response.json()
  assert.equal(receipt.drive_file_id, FILE_ID); assert.equal(receipt.idempotent, true)
  assert.equal(f.driveCalls.length, 0); assert.equal(f.rpcCalls('public_form_commit_upload').length, 0)
})

test('reserva concurrente pendiente no crea archivo, carpeta ni consulta permisos Drive', async () => {
  const f = fixture({ rpc: { public_form_reserve_upload: () => ({ data: { reservation_id: RESERVATION, status: 'reserved', created: false, adjunto_id: null, storage_path: null } }) } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'public_upload_pending')
  assert.equal(f.driveCalls.length, 0); assert.equal(f.rpcCalls('public_form_commit_upload').length, 0)
})

test('raíz con acceso anyone falla cerrado y libera una reserva nueva sin crear archivo', async () => {
  const f = fixture({ permissions: [{ type: 'user' }, { type: 'anyone' }] })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'public_storage_not_private')
  assert.equal(f.calls.some(call => call.type === 'drive-folder' || call.type === 'drive-upload'), false)
  assert.equal(f.rpcCalls('public_form_release_upload').length, 1)
})

test('raíz pública en una página posterior falla cerrado antes de crear carpeta o archivo', async () => {
  const f = fixture({ permissionPages: {
    'synthetic-private-root': {
      first: { permissions: [{ type: 'user' }], nextPageToken: 'second' },
      second: { permissions: [{ type: 'anyone' }] },
    },
  } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'public_storage_not_private')
  const permissions = f.calls.filter(call => call.type === 'drive-permissions')
  assert.deepEqual(permissions.map(call => call.params.pageToken ?? 'first'), ['first', 'second'])
  assert.equal(f.calls.some(call => call.type === 'drive-folder' || call.type === 'drive-upload'), false)
  assert.equal(f.rpcCalls('public_form_release_upload').length, 1)
})

test('subcarpeta por folio con permiso anyone propio no recibe evidencia aunque raíz sea privada', async () => {
  const f = fixture({ permissionPages: {
    'synthetic-private-root': { first: { permissions: [{ type: 'user' }] } },
    'synthetic-private-subfolder': { first: { permissions: [{ type: 'user' }, { type: 'anyone' }] } },
  } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'public_storage_not_private')
  assert.deepEqual(f.calls.filter(call => call.type === 'drive-permissions').map(call => call.params.fileId), ['synthetic-private-root', 'synthetic-private-subfolder'])
  assert.equal(f.calls.some(call => call.type === 'drive-folder'), true)
  assert.equal(f.calls.some(call => call.type === 'drive-upload' || call.type === 'drive-delete'), false)
  assert.equal(f.rpcCalls('public_form_release_upload').length, 1)
})

test('paginación de permisos sin cierre falla cerrada y limita las consultas Drive', async () => {
  const pages = Object.fromEntries(['first', ...Array.from({ length: 20 }, (_, index) => 'page-' + index)].map((key, index) => [key, { permissions: [{ type: 'user' }], nextPageToken: 'page-' + index }]))
  const f = fixture({ permissionPages: { 'synthetic-private-root': pages } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 503)
  assert.equal(f.calls.filter(call => call.type === 'drive-permissions').length, 20)
  assert.equal(f.calls.some(call => call.type === 'drive-folder' || call.type === 'drive-upload'), false)
  assert.equal(f.rpcCalls('public_form_release_upload').length, 1)
})

test('configuración o consulta de permisos fallida libera reserva antes de escritura Drive', async () => {
  for (const options of [{ noDrive: true }, { permissionsError: new Error('Drive unavailable ' + PII) }, { read: { configuraciones_sistema: () => ({ data: { valor: 'REEMPLAZAME-root' } }) } }]) {
    const f = fixture(options)
    assert.equal((await f.upload(uploadRequest())).status, 503)
    assert.equal(f.calls.some(call => call.type === 'drive-upload'), false)
    assert.equal(f.rpcCalls('public_form_release_upload').length, 1)
  }
})

test('respuesta de commit perdida recupera confirmación bajo reserva y conserva el archivo', async () => {
  const f = fixture({ rpc: { public_form_commit_upload: (args, _count, state) => {
    state.reservation = { ...state.reservation, status: 'committed', adjunto_id: ADJUNTO, storage_path: args.p_storage_path }
    throw new TypeError('fetch failed after committed ' + PII)
  } } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 200); assert.equal((await response.json()).idempotent, true)
  assert.equal(f.rpcCalls('public_form_reserve_upload').length, 2)
  assert.equal(f.calls.some(call => call.type === 'drive-delete'), false)
  assert.equal(f.rpcCalls('public_form_release_upload').length, 0)
})

test('commit rechazado con reserva conocida borra solo el ID subido y después libera quota', async () => {
  const f = fixture({ rpc: { public_form_commit_upload: () => ({ error: { code: '23505', message: 'PUBLIC_UPLOAD_CLOSED' } }) } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 409)
  const deletion = f.calls.find(call => call.type === 'drive-delete')
  assert.equal(deletion.params.fileId, FILE_ID)
  assert.equal(f.rpcCalls('public_form_reserve_upload').length, 2)
  assert.equal(f.rpcCalls('public_form_release_upload').length, 1)
  assert.equal(f.calls.indexOf(deletion) < f.calls.findIndex(call => call.resource === 'public_form_release_upload'), true)
})

test('commit ambiguo y reconciliación fallida conservan archivo y cuota para resolver después', async () => {
  const f = fixture({ rpc: {
    public_form_commit_upload: () => { throw new TypeError('fetch failed ' + PII) },
    public_form_reserve_upload: (_args, count, state) => count === 1 ? { data: state.reservation } : { error: { code: '08006', message: 'Network unavailable ' + PII } },
  } })
  assert.equal((await f.upload(uploadRequest())).status, 503)
  assert.equal(f.calls.some(call => call.type === 'drive-delete'), false)
  assert.equal(f.rpcCalls('public_form_release_upload').length, 0)
})

test('timeout de Drive sin ID nunca libera cuota a ciegas; 4xx determinista sí la libera', async () => {
  for (const [uploadError, released] of [[new DOMException('Unknown Drive result ' + PII, 'TimeoutError'), false], [Object.assign(new Error('Rejected upload'), { outcome: 'rejected', status: 400 }), true]]) {
    const f = fixture({ uploadError })
    assert.equal((await f.upload(uploadRequest())).status, 503)
    assert.equal(f.rpcCalls('public_form_release_upload').length, released ? 1 : 0)
    assert.equal(f.calls.some(call => call.type === 'drive-delete'), false)
    assert.equal(f.rpcCalls('public_form_commit_upload').length, 0)
  }
})

test('compensación incierta incluido 404 no libera cuota; papelera confirmada sí', async () => {
  for (const [deleteError, released] of [[new Error('Drive delete unavailable'), false], [Object.assign(new Error('Unconfirmed 404'), { code: 404 }), false], [null, true]]) {
    const f = fixture({ deleteError, rpc: { public_form_commit_upload: () => ({ error: { code: '23505', message: 'PUBLIC_UPLOAD_CLOSED' } }) } })
    assert.equal((await f.upload(uploadRequest())).status, 409)
    assert.equal(f.rpcCalls('public_form_release_upload').length, released ? 1 : 0)
  }
})

test('finalización idempotente toma IDs solo de la capacidad y rechaza extras antes del backend', async () => {
  const f = fixture()
  for (let i = 0; i < 2; i++) {
    const response = await f.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: cap() }))
    assert.equal(response.status, 200); assert.equal((await response.json()).folio, FOLIO)
  }
  assert.deepEqual(f.rpcCalls()[0].args, { p_form_id: FORM, p_submission_id: SUBMISSION, p_queja_id: QUEJA })
  assert.equal(f.calls.filter(call => call.type === 'mail-wake-scheduled').length, 2)
  assert.equal(f.calls.filter(call => call.type === 'mail-wake').length, 0, 'el formulario responde antes de contactar el emisor')
  await f.calls.find(call => call.type === 'mail-wake-scheduled').callback()
  assert.equal(f.calls.filter(call => call.type === 'mail-wake').length, 1)
  const invalid = fixture()
  assert.equal((await invalid.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: cap(), quejaId: OTHER }))).status, 400)
  assert.equal(invalid.effects.length, 0)
  const pending = fixture({ rpc: { public_form_finalize_submission: () => ({ error: { code: '23505', message: 'PUBLIC_UPLOAD_PENDING' } }) } })
  assert.equal((await pending.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: cap() }))).status, 409)
  assert.equal(pending.calls.filter(call => call.type === 'mail-wake-scheduled').length, 0)
})

test('un fallo al programar correo después del commit conserva el recibo y el folio', async () => {
  const f = fixture({ afterError: true })
  const response = await f.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: cap() }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).folio, FOLIO)
  assert.equal(f.calls.filter(call => call.type === 'mail-wake').length, 0)
})

test('errores de DB/SDK y fallos de compensación no exponen PII, secretos ni diagnósticos', async () => {
  const f = fixture({ rpc: { public_form_create_submission: () => ({ error: { code: 'XX000', message: PII + ' token=' + SECRET, details: 'select private_data from people', hint: PII } }) } })
  const response = await f.submit(jsonRequest('/api/public/quejas', DRAFT))
  assert.equal(response.status, 503)
  const output = (await response.text()) + JSON.stringify(f.logs)
  for (const value of [PII, SECRET, 'private_data', 'Persona sintética', 'persona@example.test']) assert.equal(output.includes(value), false, value)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('22023 interno se informa como indisponibilidad y no como datos del ciudadano', async () => {
  for (const message of ['Falta configurar el plazo y el calendario.', 'PUBLIC_RATE_INPUT_INVALID', 'Formato de texto inválido.']) {
    const f = fixture({ rpc: { public_form_create_submission: () => ({ error: { code: '22023', message, details: PII } }) } })
    const response = await f.submit(jsonRequest('/api/public/quejas', DRAFT))
    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.code, 'public_forms_unavailable')
    assert.equal(f.driveCalls.length, 0)
    assert.equal(JSON.stringify(body).includes(message), false)
    assert.equal(JSON.stringify(f.logs).includes(PII), false)
  }
  const invalid = fixture({ rpc: { public_form_create_submission: () => ({ error: { code: '22023', message: 'PUBLIC_SUBMISSION_INPUT_INVALID' } }) } })
  const response = await invalid.submit(jsonRequest('/api/public/quejas', DRAFT))
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'invalid_public_request')
})

test('SDK BotID real en desarrollo devuelve humano por bypass y no prueba protección desplegada', async () => {
  const previous = process.env.NODE_ENV, warn = console.warn, error = console.error
  process.env.NODE_ENV = 'development'; console.warn = () => {}; console.error = () => {}
  try {
    const result = await checkBotId({ advancedOptions: { checkLevel: 'basic' } })
    assert.equal(result.isHuman, true); assert.equal(result.isBot, false); assert.equal(result.bypassed, true)
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous
    console.warn = warn; console.error = error
  }
})

test('instrumentación fija Basic en los cinco POST y config usa rewrites oficiales de Vercel', async () => {
  let configured
  loadModule('instrumentation-client.ts', { 'botid/client/core': { initBotId: options => { configured = options } } })
  assert.deepEqual(JSON.parse(JSON.stringify(configured.protect)), ['/api/public/quejas','/api/drive/upload-public','/api/public/quejas/finalizar','/api/public/seguimiento','/api/public/seguimiento/documento'].map(path => ({ path, method: 'POST', advancedOptions: { checkLevel: 'basic' } })))
  const config = loadModule('next.config.ts').default
  const rewrites = await config.rewrites()
  assert.equal(rewrites.length, 2)
  assert.ok(rewrites.every(rule => rule.destination.startsWith('https://api.vercel.com/bot-protection/')))
  const headers = await config.headers()
  assert.ok(headers.some(rule => rule.headers.some(header => header.key === 'Content-Security-Policy' && header.value === "frame-ancestors 'self'")))
})

test('proxy solo abre rutas públicas exactas y sigue retirando identidad cliente', async () => {
  const calls = []
  const { proxy } = loadModule('proxy.ts', {
    'next/server': { NextResponse: { next: options => { calls.push(options); return Response.json({ passed: true }) }, json: Response.json } },
    '@/lib/server/auth': { getAuthToken: () => null, getCurrentUser: async () => { throw new Error('Unexpected authentication') } },
    '@/lib/server/apiAuthentication': { authenticatesInRoute: () => false },
  }, { Headers })
  for (const pathname of ['/api/public/quejas','/api/public/quejas/finalizar','/api/drive/upload-public','/api/public/formularios/' + TOKEN]) {
    const request = new Request('https://app.example.test' + pathname, { headers: { 'x-user-id': OTHER, 'x-user-role': 'admin', 'x-user-email': 'synthetic@example.test' } })
    request.nextUrl = new URL(request.url)
    assert.equal((await proxy(request)).status, 200)
    const headers = calls.at(-1).request.headers
    for (const key of ['x-user-id','x-user-role','x-user-email']) assert.equal(headers.has(key), false)
  }
  for (const pathname of ['/api/public/quejas/admin','/api/drive/upload-public/extra','/api/public/formularios/' + TOKEN + '/extra','/api/public/other','/api/usuarios']) {
    const request = new Request('https://app.example.test' + pathname); request.nextUrl = new URL(request.url)
    assert.equal((await proxy(request)).status, 401)
  }
})


test('archivo recién subido con acceso anónimo se elimina y no registra metadata', async () => {
  const f = fixture({ permissionPages: {
    [FILE_ID]: { first: { permissions: [{ type: 'anyone' }] } },
  } })
  const response = await f.upload(uploadRequest())
  assert.equal(response.status, 503)
  assert.equal(f.rpcCalls('public_form_commit_upload').length, 0)
  assert.equal(f.calls.find(call => call.type === 'drive-delete').params.fileId, FILE_ID)
  assert.equal(f.rpcCalls('public_form_release_upload').length, 1)
})

test('honeypot poblado se distingue de BotID y rechaza antes de backend y Drive', async () => {
  const f = fixture()
  const response = await f.submit(jsonRequest('/api/public/quejas', { ...DRAFT, honeypot: 'synthetic-autofill' }))
  assert.equal(response.status, 403); assert.equal((await response.json()).code, 'honeypot_rejected')
  assert.equal(f.effects.length, 0)
})

test('la finalización distingue seguimiento apagado, disponible y pendiente sin fallar el registro', async () => {
  const disabled = fixture()
  const disabledResponse = await disabled.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: cap() }))
  assert.equal(disabledResponse.status, 200)
  assert.equal((await disabledResponse.json()).trackingState, 'disabled')
  const env = { PUBLIC_TRACKING_ENABLED: 'true', PUBLIC_TRACKING_SIGNING_SECRET: SECRET, PUBLIC_TRACKING_ORIGIN: 'https://app.example.test' }
  const available = fixture({ env, rpc: { qms_public_tracking_access: () => ({ data: { nonce: OTHER, closed_at: null, expires_at: null } }) } })
  const availableResponse = await available.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: cap() }))
  const body = await availableResponse.json()
  assert.equal(availableResponse.status, 200)
  assert.equal(body.trackingState, 'available')
  assert.match(body.trackingUrl, /^https:\/\/app\.example\.test\/q\/seguimiento#clave=/)
  const pending = fixture({ env, rpc: { qms_public_tracking_access: () => ({ error: { code: '42883', message: PII } }) } })
  const pendingResponse = await pending.finalize(jsonRequest('/api/public/quejas/finalizar', { uploadToken: cap() }))
  const pendingBody = await pendingResponse.json()
  assert.equal(pendingResponse.status, 200)
  assert.equal(pendingBody.trackingState, 'pending')
  assert.equal(Object.hasOwn(pendingBody, 'trackingUrl'), false)
  assert.equal(pendingBody.folio, FOLIO)
  assert.equal(pending.rpcCalls('public_form_finalize_submission').length, 1)
  assert.equal(pending.rpcCalls('public_form_create_submission').length, 0)
  assert.equal((JSON.stringify(pendingBody) + JSON.stringify(pending.logs)).includes(PII), false)
})
