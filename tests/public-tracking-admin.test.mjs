import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const formId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const privateUrl = 'https://qms.example.test/q/seguimiento#clave=synthetic.payload'
const api = loadModule('lib/services/publicTrackingAdminClient.ts', { '@/lib/services/apiClient': { apiFetch() {} } })

test('enlaces privados aceptan únicamente el formato de seguimiento HTTPS o HTTP loopback', () => {
  for (const url of [privateUrl, 'http://localhost:3000/q/seguimiento#clave=synthetic.payload', 'http://127.0.0.1:3000/q/seguimiento#clave=synthetic.payload', 'http://[::1]:3000/q/seguimiento#clave=synthetic.payload'])
    assert.equal(api.validarEnlaceSeguimientoPrivado(url), url)
  for (const url of [null, '', 'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://qms.example.test/q/seguimiento#clave=synthetic.payload', 'https://user:pass@qms.example.test/q/seguimiento#clave=synthetic.payload', 'https://qms.example.test/otro#clave=synthetic.payload', 'https://qms.example.test/q/seguimiento?clave=synthetic.payload', 'https://qms.example.test/q/seguimiento#clave=synthetic.payload&x=1', 'https://qms.example.test/q/seguimiento#clave=sin-firma', 'https://qms.example.test:444/q/seguimiento#clave=synthetic.payload', 'https://qms.example.test/otro/../q/seguimiento#clave=synthetic.payload', 'https://qms.example.test/q/seguimiento#clave='+'a'.repeat(1025)+'.b']) {
    assert.throws(() => api.validarEnlaceSeguimientoPrivado(url), error => /enlace privado válido/.test(error.message) && (!url || !error.message.includes(String(url))))
  }
})

test('obtener el enlace envía Bearer, cuerpo mínimo, signal y no-store sin RPC ni caché de capacidades', async () => {
  const requests = [], controller = new AbortController()
  const client = loadModule('lib/services/publicTrackingAdminClient.ts', {
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-token' } } }) } } },
  }, { fetch: async (url, options) => { requests.push({ url, options }); return Response.json({ url: privateUrl }) } })
  assert.equal(await client.obtenerEnlaceSeguimientoPrivado({ formId, folio: ' 2026-001 ' }, controller.signal), privateUrl)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/api/quejas/seguimiento')
  assert.equal(requests[0].options.headers.Authorization, 'Bearer synthetic-token')
  assert.equal(requests[0].options.cache, 'no-store')
  assert.equal(requests[0].options.signal, controller.signal)
  assert.deepEqual(JSON.parse(requests[0].options.body), { formId, folio: '2026-001' })
})

test('inputs inválidos y abortos no generan solicitudes ni propagan errores remotos o credenciales', async () => {
  const calls = []
  const client = loadModule('lib/services/publicTrackingAdminClient.ts', { '@/lib/services/apiClient': { apiFetch: async (...args) => { calls.push(args); throw new Error('Bearer private-provider-value') } } })
  for (const input of [{ formId: 'invalid', folio: '2026-001' }, { formId, folio: '' }, { formId, folio: 'a'.repeat(121) }, { formId, folio: '2026-001\nSELECT' }]) await assert.rejects(client.obtenerEnlaceSeguimientoPrivado(input), /válidos/)
  assert.equal(calls.length, 0)
  await assert.rejects(client.obtenerEnlaceSeguimientoPrivado({ formId, folio: '2026-001' }), error => !/Bearer|private-provider/.test(error.message))
  let sessions = 0, fetches = 0
  const aborted = new AbortController(); aborted.abort()
  const guarded = loadModule('lib/services/publicTrackingAdminClient.ts', {
    '@/lib/supabase': { supabase: { auth: { getSession: async () => { sessions++; return { data: {} } } } } },
  }, { fetch: async () => { fetches++; return Response.json({ url: privateUrl }) } })
  await assert.rejects(guarded.obtenerEnlaceSeguimientoPrivado({ formId, folio: '2026-001' }, aborted.signal), error => error.name === 'AbortError')
  assert.equal(sessions, 0)
  assert.equal(fetches, 0)
})

test('errores HTTP y JSON inválidos no producen enlaces para Abrir ni muestran cuerpos privados', async () => {
  for (const response of [Response.json({ error: 'private SQL' }, { status: 404 }), Response.json({ error: 'private key' }, { status: 403 }), Response.json({}, { status: 503 }), Response.json([]), Response.json({ url: 'javascript:alert(1)' }), new Response('malformed')]) {
    const client = loadModule('lib/services/publicTrackingAdminClient.ts', { '@/lib/services/apiClient': { apiFetch: async () => response } })
    await assert.rejects(client.obtenerEnlaceSeguimientoPrivado({ formId, folio: '2026-001' }), error => !/private|SQL|javascript|malformed/.test(error.message))
  }
})

function modalFixture({ enabled = true, checking = false, unavailable = false } = {}) {
  const slots = [], requests = [], toasts = []
  const { createRequestScope } = loadModule('lib/utils/requestScope.ts')
  const scope = { ...createRequestScope(), captureContext: () => () => true }; scope.activate()
  let cursor = 0, changed = false, tree, closed = 0
  const { default: Modal } = loadModule('app/configuracion/components/SeguimientoFormularioModal.tsx', {
    react: {
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i] },
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { if (!Object.is(slots[i], value)) { slots[i] = value; changed = true } }] },
    },
    '@/components/Modal': { default: 'Modal' }, '@/components/ui/Button': { default: 'Button' }, '@/components/ui/Input': { default: 'Input' }, '@/components/ui/Field': { default: 'Field' },
    '@/hooks/useEntityRequestGuard': { useEntityRequestGuard: () => scope },
    '@/lib/services/errorToast': { showSuccess: value => toasts.push(value), showError: () => {} },
    '@/lib/services/publicTrackingAdminClient': { obtenerEnlaceSeguimientoPrivado: (input, signal) => new Promise((resolve, reject) => requests.push({ input, signal, resolve, reject })) },
  }, { window: { location: { origin: 'http://localhost:3000' } }, navigator: { clipboard: { writeText: async () => {} } } })
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
  const text = value => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
  const nodes = () => visit(tree)
  function render() { do { cursor = 0; changed = false; tree = Modal({ formulario: { id: formId, nombre: 'Formulario sintético', token: 'public-token' }, enabled, checking, unavailable, onRetry() {}, onClose() { closed++ } }) } while (changed) }
  render()
  return { requests, toasts, nodes, render, scope,
    folio(value) { nodes().find(node => node.type === 'Input' && node.props.id === 'seguimiento-consecutivo').props.onChange({ target: { value } }); render() },
    submit() { const pending = nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render(); return pending },
    form: () => nodes().find(node => node.type === 'form'),
    button: label => nodes().find(node => node.type === 'Button' && text(node) === label),
    close() { nodes().find(node => node.type === 'Modal').props.onClose(); render() },
    privateLink: () => nodes().find(node => node.type === 'a' && node.props.href === privateUrl),
    closed: () => closed,
  }
}

test('feature apagada conserva solo la referencia pública y nunca busca un expediente por folio', () => {
  const modal = modalFixture({ enabled: false })
  assert.equal(modal.button('Obtener enlace privado').props.disabled, true)
  modal.folio('2026-001'); modal.submit()
  assert.equal(modal.requests.length, 0)
  assert.ok(modal.nodes().some(node => node.type === 'a' && node.props.href === 'http://localhost:3000/q/seguimiento'))
  assert.equal(modal.privateLink(), undefined)
})

test('cerrar aborta la petición y su resultado tardío no publica la capacidad', async () => {
  const modal = modalFixture()
  modal.folio('2026-001'); modal.submit()
  assert.equal(modal.requests.length, 1)
  modal.close()
  assert.equal(modal.closed(), 1)
  assert.equal(modal.requests[0].signal.aborted, true)
  modal.requests[0].resolve(privateUrl)
  await new Promise(resolve => setImmediate(resolve)); modal.render()
  assert.equal(modal.privateLink(), undefined)
  assert.equal(modal.toasts.length, 0)
})

test('la capacidad solo llega por acción explícita, doble envío se bloquea y editar folio limpia el enlace', async () => {
  const modal = modalFixture()
  assert.equal(modal.requests.length, 0)
  modal.folio('2026-001'); modal.submit(); modal.submit()
  assert.equal(modal.requests.length, 1)
  assert.deepEqual({ ...modal.requests[0].input }, { formId, folio: '2026-001' })
  modal.requests[0].resolve(privateUrl)
  await new Promise(resolve => setImmediate(resolve)); modal.render()
  const link = modal.privateLink()
  assert.equal(link.props.target, '_blank')
  assert.equal(link.props.rel, 'noopener noreferrer')
  assert.equal(link.props.referrerPolicy, 'no-referrer')
  assert.equal(link.props.prefetch, undefined)
  modal.folio('2026-002')
  assert.equal(modal.privateLink(), undefined)
})
