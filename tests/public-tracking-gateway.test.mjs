import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { loadModule } from './load-module.mjs'

const Q = '11111111-1111-4111-8111-111111111111'
const N = '22222222-2222-4222-8222-222222222222'
const D = '33333333-3333-4333-8333-333333333333'
const FORM = '44444444-4444-4444-8444-444444444444'
const SECRET = 'synthetic-tracking-secret-not-a-real-secret'
const PII = 'PRIVATE_SYNTHETIC_INTERNAL_NOTE'
const NOW = Date.UTC(2026, 9, 15, 18)
class FixedDate extends Date { static now() { return NOW } }
const status = { folio: '2026-001', estado: 'Resuelto', recibido_at: '2026-10-15T12:00:00Z', actualizado_at: '2026-10-15T13:00:00Z',
  etapas: [{ nombre: 'Recepción', fecha: '2026-10-15T12:00:00Z', usuario: PII }], respuesta: 'Respuesta aprobada.', numero_oficio: 'ECA-001',
  documento: { id: D, nombre: 'oficio.pdf', tipo_mime: 'application/pdf', tamano: 3, storage_path: PII }, email_cliente: PII, notas: PII }
const capability = loadModule('supabase/functions/_shared/publicTrackingCapability.ts')
const token = claims => capability.mintPublicTrackingCapability({ quejaId: Q, nonce: N, ...claims }, SECRET)
const post = (body, path = '/api/public/seguimiento', headers = {}) => new Request('https://app.example.test' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.42', ...headers }, body: JSON.stringify(body) })

function fixture(options = {}) {
  const calls = []
  const sdk = createClient('https://synthetic-supabase.example.test', 'synthetic-server-credential', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
    const parsed = new URL(url), resource = parsed.pathname.split('/').pop()
    const args = init.body ? JSON.parse(init.body) : null
    calls.push({ resource, args, query: parsed.searchParams })
    if (options.errors?.[resource]) return Response.json(options.errors[resource], { status: 400 })
    let value
    if (resource === 'public_form_consume_rate') value = { allowed: !options.quotaDenied, retry_after: 100 }
    else if (resource === 'qms_public_tracking_read') value = options.readNull ? null : options.status ?? status
    else if (resource === 'qms_public_tracking_document') value = { storage_path: 'synthetic-private-drive-id', nombre: 'oficio.pdf', tipo_mime: 'application/pdf', tamano: 3, folio: '2026-001', ...options.document }
    else if (resource === 'qms_public_tracking_access') value = { queja_id: Q, nonce: N, closed_at: null, expires_at: null, ...options.access }
    else if (resource === 'configuraciones_sistema') value = { valor: 'synthetic-private-root' }
    else if (resource === 'quejas') value = { id: Q }
    else if (resource === 'public_form_submissions') value = options.otherForm ? null : { queja_id: Q }
    else throw new Error('unexpected synthetic resource ' + resource)
    return Response.json(value)
  } } })
  const globals = { Date: FixedDate, process: { env: { NODE_ENV: 'production', VERCEL: '1', PUBLIC_TRACKING_ENABLED: 'true', PUBLIC_TRACKING_SIGNING_SECRET: SECRET, PUBLIC_TRACKING_ORIGIN: 'https://app.example.test', ...options.env } } }
  const mocks = {
    'botid/server': { checkBotId: async optionsForBot => {
      calls.push({ resource: 'bot', options: optionsForBot })
      if (options.botError) throw options.botError
      return options.bot ?? { isHuman: true, isBot: false, isVerifiedBot: false }
    } },
    '@/lib/server/auth': { getCurrentUser: async request => request.headers.get('authorization') === 'Bearer valid-synthetic' ? { id: D, rol: options.role ?? 'admin' } : null },
    '@/lib/server/supabase-admin': { createServiceClient: () => { calls.push({ resource: 'service' }); return sdk } },
    '@/lib/server/drive': {
      assertDriveCaseFile: async (...args) => { calls.push({ resource: 'drive-scope', args: args.slice(1) }); if (options.scopeError) throw new Error('private-scope-error') },
      getDriveClient: () => ({ files: { get: async args => { calls.push({ resource: 'drive-media', args }); return { data: Readable.from([Buffer.from(options.largeFile ? 'a'.repeat(4 * 1024 * 1024 + 1) : 'PDF')]) } } } }),
    },
    '@/lib/utils/logger': { logger: { error: () => {} } },
  }
  return { calls, route: loadModule('app/api/public/seguimiento/route.ts', mocks, globals),
    download: loadModule('app/api/public/seguimiento/documento/route.ts', mocks, globals),
    admin: loadModule('app/api/quejas/seguimiento/route.ts', mocks, globals) }
}

test('BotID rechaza bots y fallos del verificador antes de backend, cuotas y Drive en ambas operaciones', async () => {
  const key = await token()
  const cases = [
    [{ bot: { isHuman: false, isBot: true } }, 403],
    [{ bot: { isHuman: true, isBot: false, isVerifiedBot: true } }, 403],
    [{ bot: { isHuman: false, isBot: false } }, 403],
    [{ bot: { isHuman: true } }, 503],
    [{ bot: { isHuman: 'true', isBot: false } }, 503],
    [{ botError: new Error('SYNTHETIC_PRIVATE_SDK_FAILURE') }, 503],
  ]
  for (const [options, expected] of cases) for (const operation of ['route', 'download']) {
    const f = fixture(options)
    const path = '/api/public/seguimiento' + (operation === 'download' ? '/documento' : '')
    const input = { clave: key, ...(operation === 'download' ? { documentoId: D } : {}) }
    const response = await f[operation].POST(post(input, path))
    assert.equal(response.status, expected)
    assert.deepEqual(f.calls.map(call => call.resource), ['bot'])
    assert.equal(f.calls[0].options.advancedOptions.checkLevel, 'basic')
    assert.equal(f.calls[0].options.developmentOptions.isDevelopment, false)
    const body = await response.text()
    for (const privateValue of [key, SECRET, PII, 'SYNTHETIC_PRIVATE_SDK_FAILURE']) assert.equal(body.includes(privateValue), false)
  }
})

test('los permisos de prueba local no prevalecen sobre Vercel ni abren producción fuera de loopback', async () => {
  const key = await token()
  for (const operation of ['route', 'download']) {
    const path = '/api/public/seguimiento' + (operation === 'download' ? '/documento' : '')
    const input = { clave: key, ...(operation === 'download' ? { documentoId: D } : {}) }
    const localRequest = host => new Request('http://' + host + path, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' }, body: JSON.stringify(input) })
    for (const host of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000']) {
      const local = fixture({ env: { VERCEL: undefined, PUBLIC_FORMS_LOCAL_TESTING: 'true' } })
      assert.equal((await local[operation].POST(localRequest(host))).status, 200)
      assert.equal(local.calls.some(call => call.resource === 'bot'), false)
    }
    for (const options of [
      { env: { VERCEL: undefined } },
      { env: { VERCEL: undefined, PUBLIC_FORMS_LOCAL_TESTING: 'true' } },
    ]) {
      const external = fixture(options)
      assert.equal((await external[operation].POST(post(input, path))).status, 503)
      assert.equal(external.calls.length, 0)
    }
    const development = fixture({ env: { NODE_ENV: 'development', VERCEL: undefined } })
    assert.equal((await development[operation].POST(localRequest('localhost:3000'))).status, 200)
    assert.equal(development.calls.some(call => call.resource === 'bot'), false)
    const deployed = fixture({ env: { NODE_ENV: 'development', PUBLIC_FORMS_LOCAL_TESTING: 'true' }, bot: { isHuman: false, isBot: true } })
    assert.equal((await deployed[operation].POST(localRequest('localhost:3000'))).status, 403)
    assert.deepEqual(deployed.calls.map(call => call.resource), ['bot'])
  }
})

test('una prueba humana no sustituye la capacidad privada ni permite leer o descargar con una firma falsa', async () => {
  const key = await token()
  for (const operation of ['route', 'download']) {
    const path = '/api/public/seguimiento' + (operation === 'download' ? '/documento' : '')
    const f = fixture()
    const response = await f[operation].POST(post({ clave: key + 'x', ...(operation === 'download' ? { documentoId: D } : {}) }, path))
    assert.equal(response.status, 404)
    // Los intentos inválidos consumen cuota, pero nunca consultan el expediente o Drive.
    assert.deepEqual(f.calls.map(call => call.resource), ['bot', 'service', 'public_form_consume_rate'])
  }
})

test('el gateway proyecta solo estado, hechos públicos y oficio, sin PII ni IDs de Drive', async () => {
  const f = fixture(), key = await token()
  const response = await f.route.POST(post({ clave: key }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.match(response.headers.get('x-robots-tag'), /noindex/)
  const body = await response.text()
  assert.ok(!body.includes(PII)); assert.ok(!body.includes('storage_path')); assert.ok(!body.includes('email_cliente'))
  assert.equal(JSON.parse(body).folio, '2026-001')
  assert.deepEqual(f.calls.find(x => x.resource === 'qms_public_tracking_read').args, { p_queja_id: Q, p_nonce: N })
})

test('consecutivo solo, clave alterada, versión anterior o de otro propósito no acceden a expedientes', async () => {
  const key = await token()
  const oldPayload = Buffer.from(JSON.stringify({ purpose: 'qms-public-tracking-v1', queja_id: Q, nonce: N, expires_at: NOW / 1000 + 86400 })).toString('base64url')
  const previous = oldPayload + '.' + createHmac('sha256', SECRET).update('qms-public-tracking-v1\0' + oldPayload).digest('base64url')
  for (const body of [{ folio: '2026-001' }, { clave: key + 'x' }, { clave: previous }, { clave: 'upload.capability' }, { clave: key, extra: true }]) {
    const f = fixture(), response = await f.route.POST(post(body))
    assert.equal(response.status, 404)
    assert.ok(!f.calls.some(x => x.resource === 'qms_public_tracking_read'))
  }
})

test('revocado, inexistente y folio distinto devuelven la misma respuesta genérica', async () => {
  const key = await token(), bodies = []
  for (const [options, input] of [[{ errors: { qms_public_tracking_read: { code: '42501', message: PII } } }, { clave: key }], [{ readNull: true }, { clave: key }], [{}, { clave: key, folio: '2026-999' }]]) {
    const f = fixture(options), response = await f.route.POST(post(input))
    assert.equal(response.status, 404); bodies.push(await response.text())
  }
  assert.equal(new Set(bodies).size, 1)
})

test('la caducidad de DB bloquea consulta, descarga y nueva emisión sin acceso a Drive ni renovación', async () => {
  const key = await token(), bodies = []
  for (const operation of ['route', 'download', 'admin']) {
    const resource = operation === 'route' ? 'qms_public_tracking_read' : operation === 'download' ? 'qms_public_tracking_document' : 'qms_public_tracking_access'
    const f = fixture({ errors: { [resource]: { code: '42501', message: 'PUBLIC_TRACKING_UNAVAILABLE ' + PII } } })
    const response = operation === 'admin'
      ? await f.admin.POST(post({ formId: FORM, folio: '2026-001' }, '/api/quejas/seguimiento', { authorization: 'Bearer valid-synthetic' }))
      : await f[operation].POST(post({ clave: key, ...(operation === 'download' ? { documentoId: D } : {}) }, '/api/public/seguimiento' + (operation === 'download' ? '/documento' : '')))
    assert.equal(response.status, 404)
    const body = await response.text()
    assert.equal(body.includes(PII), false)
    assert.equal(body.includes(key), false)
    assert.equal(f.calls.some(call => call.resource.startsWith('drive-')), false)
    assert.equal(f.calls.filter(call => call.resource === resource).length, 1)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    if (operation !== 'admin') bodies.push(body)
  }
  assert.equal(new Set(bodies).size, 1)
  assert.match(bodies[0], /haber vencido/)
})

test('el mismo enlace se emite antes y después del cierre sin inventar una caducidad desde la consulta', async () => {
  const request = () => post({ formId: FORM, folio: '2026-001' }, '/api/quejas/seguimiento', { authorization: 'Bearer valid-synthetic' })
  const links = []
  for (const access of [{ closed_at: null, expires_at: null }, { closed_at: new Date(NOW).toISOString(), expires_at: new Date(NOW + 30 * 86400000).toISOString() }]) {
    const f = fixture({ access }), response = await f.admin.POST(request())
    assert.equal(response.status, 200)
    links.push((await response.json()).url)
    assert.equal(f.calls.filter(call => call.resource === 'qms_public_tracking_access').length, 1)
  }
  assert.equal(links[0], links[1])
  assert.deepEqual(JSON.parse(JSON.stringify(await capability.verifyPublicTrackingCapability(new URL(links[0]).hash.slice(7), SECRET))), { quejaId: Q, nonce: N })
})

test('cuota transaccional precede la búsqueda y un origen ajeno se rechaza sin lectura privilegiada', async () => {
  const key = await token(), f = fixture({ quotaDenied: true })
  assert.equal((await f.route.POST(post({ clave: key }))).status, 429)
  assert.ok(!f.calls.some(x => x.resource === 'qms_public_tracking_read'))
  const foreign = fixture()
  assert.equal((await foreign.route.POST(post({ clave: key }, undefined, { origin: 'https://foreign.example.test' }))).status, 404)
  assert.equal(foreign.calls.length, 0)
})

test('desactivación o configuración incompleta fallan cerradas, sin llamar DB', async () => {
  for (const env of [{ PUBLIC_TRACKING_ENABLED: 'false' }, { PUBLIC_TRACKING_SIGNING_SECRET: '' }, { PUBLIC_TRACKING_ORIGIN: 'https://foreign.example.test/path' }]) {
    const f = fixture({ env })
    assert.equal((await f.route.POST(post({ clave: await token() }))).status, 503)
    assert.equal(f.calls.length, 0)
  }
})

test('el body tiene límite real y el JSON duplicado se rechaza', async () => {
  const f = fixture()
  assert.equal((await f.route.POST(post({ clave: 'a'.repeat(65537) }))).status, 413)
  const duplicate = new Request('https://app.example.test/api/public/seguimiento', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.42' }, body: '{"clave":"one","clave":"two"}' })
  assert.equal((await f.route.POST(duplicate)).status, 400)
  assert.ok(!f.calls.some(x => x.resource === 'qms_public_tracking_read'))
})

test('el adjunto publicado se verifica en DB y Drive y se fuerza descarga, sin revelar su ruta', async () => {
  const f = fixture(), response = await f.download.POST(post({ clave: await token(), documentoId: D }, '/api/public/seguimiento/documento'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/octet-stream')
  assert.match(response.headers.get('content-disposition'), /^attachment;/)
  assert.equal(await response.text(), 'PDF')
  assert.deepEqual(f.calls.find(x => x.resource === 'qms_public_tracking_document').args, { p_queja_id: Q, p_nonce: N, p_adjunto_id: D })
  assert.equal(f.calls.filter(x => x.resource === 'drive-scope').length, 1)
})

test('un archivo de otro caso o no publicado nunca llega a Drive; tampoco se acepta una ruta libre', async () => {
  for (const opts of [{ errors: { qms_public_tracking_document: { code: '42501', message: PII } } }, { document: { storage_path: 'foreign/path' } }]) {
    const f = fixture(opts), response = await f.download.POST(post({ clave: await token(), documentoId: D }, '/api/public/seguimiento/documento'))
    assert.ok([404, 503].includes(response.status)); assert.ok(!f.calls.some(x => x.resource === 'drive-media'))
    assert.ok(!(await response.text()).includes(PII))
  }
})

test('un archivo modificado fuera de la app mantiene el tope de cuatro MiB', async () => {
  const f = fixture({ largeFile: true })
  assert.equal((await f.download.POST(post({ clave: await token(), documentoId: D }, '/api/public/seguimiento/documento'))).status, 503)
})

test('nombres institucionales de hasta 255 caracteres mantienen consulta y descarga válidas', async () => {
  const nombre = 'a'.repeat(196) + '.pdf'
  const f = fixture({ status: { ...status, documento: { ...status.documento, nombre } }, document: { nombre } })
  assert.equal((await f.route.POST(post({ clave: await token() }))).status, 200)
  const response = await f.download.POST(post({ clave: await token(), documentoId: D }, '/api/public/seguimiento/documento'))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-disposition'), /a{196}\.pdf/)
})

test('Configuración exige admin real antes de emitir enlaces privados; GET exige staff', async () => {
  for (const method of ['GET', 'POST']) {
    const f = fixture(), response = await f.admin[method](method === 'POST' ? post({ formId: FORM, folio: '2026-001' }, '/api/quejas/seguimiento') : new Request('https://app.example.test/api/quejas/seguimiento'))
    assert.equal(response.status, 401); assert.equal(f.calls.length, 0)
  }
  for (const role of ['colaborador', 'calidad']) {
    const f = fixture({ role }), response = await f.admin.POST(post({ formId: FORM, folio: '2026-001' }, '/api/quejas/seguimiento', { authorization: 'Bearer valid-synthetic' }))
    assert.equal(response.status, 403); assert.equal(f.calls.length, 0)
  }
  const f = fixture({ role: 'calidad' })
  assert.deepEqual(await (await f.admin.GET(new Request('https://app.example.test/api/quejas/seguimiento', { headers: { authorization: 'Bearer valid-synthetic' } }))).json(), { enabled: true })
})

test('el enlace de Configuración pertenece al formulario y solo admite envíos finalizados', async () => {
  const request = () => post({ formId: FORM, folio: '2026-001' }, '/api/quejas/seguimiento', { authorization: 'Bearer valid-synthetic' })
  const other = fixture({ otherForm: true })
  assert.equal((await other.admin.POST(request())).status, 404)
  assert.ok(!other.calls.some(x => x.resource === 'qms_public_tracking_access'))
  const f = fixture(), response = await f.admin.POST(request())
  assert.equal(response.status, 200)
  const { url } = await response.json()
  assert.match(url, /^https:\/\/app\.example\.test\/q\/seguimiento#clave=/)
  assert.equal(f.calls.find(x => x.resource === 'public_form_submissions').query.get('form_id'), `eq.${FORM}`)
  assert.equal(f.calls.find(x => x.resource === 'public_form_submissions').query.get('finalized_at'), 'not.is.null')
})

test('un seguimiento activo con configuración incompleta no anuncia compatibilidad legacy', async () => {
  for (const env of [{ PUBLIC_TRACKING_SIGNING_SECRET: '' }, { PUBLIC_TRACKING_ORIGIN: 'https://app.example.test/path' }, { PUBLIC_TRACKING_ENABLED: 'tru' }]) {
    const f = fixture({ env })
    const response = await f.admin.GET(new Request('https://app.example.test/api/quejas/seguimiento', { headers: { authorization: 'Bearer valid-synthetic' } }))
    assert.equal(response.status, 503)
    assert.ok(!Object.hasOwn(await response.json(), 'enabled'))
    assert.equal(f.calls.length, 0)
  }
  const f = fixture({ env: { PUBLIC_TRACKING_ENABLED: 'false' } })
  const response = await f.admin.GET(new Request('https://app.example.test/api/quejas/seguimiento', { headers: { authorization: 'Bearer valid-synthetic' } }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { enabled: false })
})

test('la página pública solo recibe disponibilidad y nunca secretos de configuración', () => {
  for (const available of [false, true]) {
    const page = loadModule('app/q/seguimiento/page.tsx', {
      '@/lib/server/publicTracking': { publicTrackingAvailable: () => available },
      '@/app/q/seguimiento/PublicTrackingPage': { default: 'PublicTrackingPage' },
    })
    assert.deepEqual(JSON.parse(JSON.stringify(page.default().props)), { available })
  }
  for (const env of [{}, { PUBLIC_TRACKING_ENABLED: 'true' }, { PUBLIC_TRACKING_ENABLED: 'false' }]) {
    const trackingModule = loadModule('lib/server/publicTracking.ts', {}, { process: { env } })
    assert.equal(trackingModule.publicTrackingAvailable(), false)
  }
})

test('la recuperación pide un enlace completo, nunca un consecutivo ni una contraseña inventada', () => {
  const { claveDesdeEnlace } = loadModule('lib/services/publicTrackingClient.ts')
  assert.equal(claveDesdeEnlace('https://qms.example.test/q/seguimiento#clave=synthetic.payload'), 'synthetic.payload')
  for (const value of ['2026-2070', 'synthetic.payload', 'contraseña', 'https://qms.example.test/otro#clave=synthetic.payload',
    'https://qms.example.test/q/seguimiento?clave=synthetic.payload', 'javascript:alert(1)']) assert.equal(claveDesdeEnlace(value), '')
})
