import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const TOKEN = 'synthetic-form'
const CAPABILITY = 'synthetic-upload-capability'
const DRAFT = { nombre: 'Persona de prueba', email: 'example@example.invalid', telefono: '', categoria: 'Queja', descripcion: 'Descripción sintética de prueba.' }
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const attachment = (name = 'evidencia.pdf') => new File(['contenido sintético'], name, { type: 'application/pdf', lastModified: 1 })
function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
function receipt(input) {
  return { folio: 'Q-SYNTHETIC-001', quejaId: 'synthetic-case', uploadToken: CAPABILITY, submissionId: input.submissionId, expiresAt: new Date(Date.now() + 1800000).toISOString() }
}
function client(fetch) {
  return loadModule('lib/services/publicQuejasClient.ts', {}, { fetch, crypto: webcrypto })
}
function storageShim() {
  const entries = new Map()
  return {
    getItem: key => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => { entries.set(key, String(value)) },
    removeItem: key => { entries.delete(key) },
    peek(key) { return entries.get(key) ?? null },
  }
}
function hookHarness(handler, globals = {}, storage = storageShim()) {
  const slots = [], effects = [], calls = []
  let cursor = 0, current
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useLayoutEffect(effect) {
      const index = cursor++
      if (!(index in slots)) { slots[index] = true; effects.push(effect) }
    },
  }
  const fetch = async (url, options) => {
    const call = { url, options }
    calls.push(call)
    return handler(call)
  }
  const { usePublicQuejaForm: executeFormHook } = loadModule('app/q/components/usePublicQuejaForm.ts', { react }, { fetch, crypto: webcrypto, sessionStorage: storage, window: { sessionStorage: storage }, ...globals })
  const cleanups = []
  function render() {
    cursor = 0
    current = executeFormHook(TOKEN)
    for (const effect of effects.splice(0)) cleanups.push(effect())
    return current
  }
  render()
  return {
    calls, render, storage,
    get form() { return current },
    fill(draft = DRAFT) { for (const [key, value] of Object.entries(draft)) current.updateField(key, value); render() },
    unmount() { for (const cleanup of cleanups) cleanup?.() },
    async flush() { await new Promise((resolve) => setImmediate(resolve)); return render() },
  }
}
const ordinaryHandler = ({ url, options }) => {
  if (url === '/api/public/quejas') return response(receipt(JSON.parse(options.body)))
  if (url === '/api/drive/upload-public') return response({ drive_file_id: 'synthetic-drive-file', queja_id: 'synthetic-case' })
  return response({ ok: true })
}

test('metadata pública usa el endpoint codificado y devuelve solo la proyección ciudadana', async () => {
  const calls = []
  const api = client(async (...args) => {
    calls.push(args)
    return response({ nombre: 'Formulario sintético', modulo: 'quejas', uploadsAllowed: true, id: 'interno-no-expuesto' })
  })
  const controller = new AbortController()
  const result = await api.fetchFormularioPublico('token/con espacio', controller.signal)
  assert.deepEqual(Object.keys(result).sort(), ['modulo', 'nombre', 'uploadsAllowed'])
  assert.equal(calls[0][0], '/api/public/formularios/token%2Fcon%20espacio')
  assert.equal(calls[0][1].signal, controller.signal)
  assert.equal(calls[0][1].cache, 'no-store')
  assert.equal(calls[0][1].headers, undefined)
})

test('errores públicos 503/403/409 tienen mensajes limpios y no reflejan diagnósticos del servidor', async () => {
  const api = client(async () => response({ error: 'SQL select secret from private' }, 503))
  await assert.rejects(api.fetchFormularioPublico(TOKEN), (error) => {
    assert.equal(error.status, 503)
    assert.match(api.publicErrorMessage(error, 'Error'), /no está disponible/)
    assert.doesNotMatch(error.message, /SQL|secret|private/)
    return true
  })
  assert.match(api.publicErrorMessage(new api.PublicRequestError(403), 'Error'), /verificar el envío/)
  assert.match(api.publicErrorMessage(new api.PublicRequestError(409), 'Error'), /reintentá el mismo envío/)
})

test('registro rechaza una confirmación de otro submissionId y nunca acepta un cuerpo inválido', async () => {
  const input = { ...DRAFT, formToken: TOKEN, submissionId: 'synthetic-submission', honeypot: '' }
  const api = client(async () => response({ ...receipt(input), submissionId: 'another-submission' }))
  await assert.rejects(api.crearQuejaPublica(input), /Reintentá el mismo envío/)
  const invalid = client(async () => new Response('<private diagnostics>', { status: 200 }))
  await assert.rejects(invalid.crearQuejaPublica(input), /Respuesta no válida del servicio/)
})

test('upload envía capacidad e ID del archivo y no acepta confirmación incompleta', async () => {
  const calls = []
  const api = client(async (...args) => { calls.push(args); return response({ drive_file_id: 'synthetic-file', queja_id: 'synthetic-case' }) })
  await api.subirAdjuntoPublico(attachment(), CAPABILITY, 'synthetic-upload-id')
  assert.equal(calls[0][0], '/api/drive/upload-public')
  assert.deepEqual([...calls[0][1].body.keys()].sort(), ['file', 'uploadId', 'uploadToken'])
  assert.equal(calls[0][1].body.get('uploadToken'), CAPABILITY)
  assert.equal(calls[0][1].body.get('uploadId'), 'synthetic-upload-id')
  assert.equal(calls[0][1].headers, undefined)
  const invalid = client(async () => response({ drive_file_id: 'unconfirmed-file' }))
  await assert.rejects(invalid.subirAdjuntoPublico(attachment(), CAPABILITY, 'synthetic-id'), /confirmación del archivo/)
})

test('validación pública exige correo y rechaza vacíos, formatos cruzados y archivos grandes', () => {
  const api = client(() => { throw new Error('No debe llamar red') })
  for (const email of ['', '   ', 'sin-arroba']) {
    assert.throws(() => api.validarBorradorPublico({ ...DRAFT, email }), /correo/)
  }
  assert.equal(api.validarBorradorPublico({ ...DRAFT, nombre: '  Persona  ' }).nombre, 'Persona')
  assert.throws(() => api.validarBorradorPublico({ ...DRAFT, nombre: ' ' }), /nombre/)
  assert.throws(() => api.validarBorradorPublico({ ...DRAFT, email: 'sin-arroba' }), /correo/)
  assert.throws(() => api.validarBorradorPublico({ ...DRAFT, categoria: 'inventada' }), /categoría/)
  assert.throws(() => api.validarBorradorPublico({ ...DRAFT, descripcion: 'x'.repeat(10001) }), /descripción/)
  assert.throws(() => api.validarArchivoPublico({ name: 'empty.pdf', type: 'application/pdf', size: 0 }), /vacío/)
  assert.throws(() => api.validarArchivoPublico({ name: 'office.docx', type: 'application/pdf', size: 1 }), /PDF/)
  assert.throws(() => api.validarArchivoPublico({ name: 'image.webp', type: 'image/webp', size: 1 }), /PDF/)
  assert.throws(() => api.validarArchivoPublico({ name: 'huge.pdf', type: 'application/pdf', size: api.MAX_FILE_BYTES + 1 }), /máximo/)
  api.validarArchivoPublico({ name: 'ok.PNG', type: 'image/png', size: api.MAX_FILE_BYTES })
})

test('correo ausente bloquea el formulario antes de red y conserva el borrador', async () => {
  const harness = hookHarness(() => { throw new Error('No debe llamar red') })
  harness.fill({ ...DRAFT, email: '   ' })
  await harness.form.submit()
  harness.render()
  assert.equal(harness.calls.length, 0)
  assert.equal(harness.form.draft.descripcion, DRAFT.descripcion)
  assert.match(harness.form.error, /correo/)
})

test('lock síncrono impide dos creaciones antes del render y conserva el ID tras perder la respuesta', async () => {
  const first = deferred()
  let attempts = 0
  const harness = hookHarness((call) => call.url === '/api/public/quejas' && ++attempts === 1 ? first.promise : ordinaryHandler(call))
  harness.fill()
  const handler = harness.form.submit
  const attempt = handler()
  await handler()
  assert.equal(harness.calls.length, 1)
  first.reject(new TypeError('Failed to fetch'))
  await attempt
  harness.render()
  assert.equal(harness.form.confirmationPending, true)
  assert.equal(harness.form.draft.nombre, DRAFT.nombre)
  harness.form.updateField('nombre', 'No debe reemplazar datos en confirmación')
  harness.render()
  assert.equal(harness.form.draft.nombre, DRAFT.nombre)
  await harness.form.submit()
  harness.render()
  const creations = harness.calls.filter((call) => call.url === '/api/public/quejas')
  assert.equal(creations.length, 2)
  assert.equal(creations[0].options.body, creations[1].options.body)
  assert.match(JSON.parse(creations[0].options.body).submissionId, /^[0-9a-f-]{36}$/)
  assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
  await handler()
  assert.equal(harness.calls.filter((call) => call.url === '/api/public/quejas').length, 2)
})

test('folio se publica antes de terminar uploads; fallidos reintentan su mismo ID sin otra queja', async () => {
  const pendingUpload = deferred()
  let uploads = 0
  const harness = hookHarness((call) => {
    if (call.url === '/api/drive/upload-public' && ++uploads === 1) return pendingUpload.promise
    return ordinaryHandler(call)
  })
  harness.fill()
  harness.form.agregarArchivos([attachment()])
  harness.render()
  const attempt = harness.form.submit()
  await harness.flush()
  assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
  assert.equal(harness.form.enviando, true)
  assert.equal(harness.form.archivos[0].status, 'subiendo')
  assert.equal(harness.calls.some((call) => call.url.endsWith('/finalizar')), false)
  pendingUpload.resolve(response({ error: 'No se refleja el diagnóstico' }, 502))
  await attempt
  harness.render()
  assert.equal(harness.form.archivos[0].status, 'fallido')
  assert.equal(harness.form.finalized, true)
  await harness.form.retryPending()
  harness.render()
  assert.equal(harness.form.archivos[0].status, 'subido')
  const requests = harness.calls.filter((call) => call.url === '/api/drive/upload-public')
  assert.equal(requests[0].options.body.get('uploadId'), requests[1].options.body.get('uploadId'))
  assert.equal(harness.calls.filter((call) => call.url === '/api/public/quejas').length, 1)
  assert.equal(harness.calls.filter((call) => call.url.endsWith('/finalizar')).length, 1)
})

test('fallo de finalizar conserva folio y reintenta únicamente finalización', async () => {
  let finalizations = 0
  const harness = hookHarness((call) => call.url.endsWith('/finalizar') && ++finalizations === 1 ? response({}, 502) : ordinaryHandler(call))
  harness.fill()
  harness.form.agregarArchivos([attachment()])
  harness.render()
  await harness.form.submit()
  harness.render()
  assert.equal(harness.form.finalized, false)
  assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
  assert.match(harness.form.error, /registrada/)
  await harness.form.retryPending()
  harness.render()
  assert.equal(harness.form.finalized, true)
  assert.equal(harness.calls.filter((call) => call.url === '/api/public/quejas').length, 1)
  assert.equal(harness.calls.filter((call) => call.url === '/api/drive/upload-public').length, 1)
  assert.equal(harness.calls.filter((call) => call.url.endsWith('/finalizar')).length, 2)
})

for (const status of [400, 422]) {
  test(`un rechazo ${status} al finalizar orienta el reintento y nunca culpa los datos del envío`, async () => {
    let finalizations = 0
    const harness = hookHarness((call) => call.url.endsWith('/finalizar') && ++finalizations === 1 ? response({ code: 'invalid_public_request' }, status) : ordinaryHandler(call))
    harness.fill()
    await harness.form.submit()
    harness.render()
    assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
    assert.doesNotMatch(harness.form.error, /Revisá los datos del formulario/)
    assert.match(harness.form.error, /registrada/)
    await harness.form.retryPending()
    harness.render()
    assert.equal(harness.form.finalized, true)
    assert.equal(harness.calls.filter((call) => call.url === '/api/public/quejas').length, 1)
  })
}

test('salir antes de confirmar creación aborta y descarta la respuesta tardía sin uploads ni finalizar', async () => {
  const pendingCreation = deferred()
  const harness = hookHarness(() => pendingCreation.promise)
  harness.fill()
  harness.form.agregarArchivos([attachment()])
  harness.render()
  const attempt = harness.form.submit()
  harness.unmount()
  assert.equal(harness.calls[0].options.signal.aborted, true)
  pendingCreation.resolve(response(receipt(JSON.parse(harness.calls[0].options.body))))
  await attempt
  harness.render()
  assert.equal(harness.form.receipt, null)
  assert.equal(harness.calls.length, 1)
})

test('salir durante upload no publica su respuesta tardía ni comienza otra evidencia o finalización', async () => {
  const pendingUpload = deferred()
  const harness = hookHarness((call) => call.url === '/api/drive/upload-public' ? pendingUpload.promise : ordinaryHandler(call))
  harness.fill()
  harness.form.agregarArchivos([attachment(), attachment('segunda.pdf')])
  harness.render()
  const attempt = harness.form.submit()
  await harness.flush()
  harness.unmount()
  pendingUpload.resolve(response({ drive_file_id: 'late-file', queja_id: 'synthetic-case' }))
  await attempt
  harness.render()
  assert.equal(harness.form.archivos[0].status, 'subiendo')
  assert.equal(harness.calls.filter((call) => call.url === '/api/drive/upload-public').length, 1)
  assert.equal(harness.calls.some((call) => call.url.endsWith('/finalizar')), false)
})

test('tope de diez adjuntos se aplica al seleccionar en varias visitas del control y evita duplicados', () => {
  const harness = hookHarness(ordinaryHandler)
  harness.form.agregarArchivos(Array.from({ length: 8 }, (_, index) => attachment(`documento-${index}.pdf`)))
  harness.render()
  harness.form.agregarArchivos([attachment('documento-0.pdf'), ...Array.from({ length: 4 }, (_, index) => attachment(`extra-${index}.pdf`))])
  harness.render()
  assert.equal(harness.form.archivos.length, 10)
  assert.match(harness.form.error, /No se adjuntaron 2/)
  assert.equal(new Set(harness.form.archivos.map((entry) => entry.uploadId)).size, 10)
})

test('validación previa no crea efectos y rechazo de campo 422 permite corregir sin perder los datos', async () => {
  const harness = hookHarness(() => response({ code: 'invalid_public_nombre' }, 422))
  await harness.form.submit()
  harness.render()
  assert.equal(harness.calls.length, 0)
  harness.fill()
  await harness.form.submit()
  harness.render()
  assert.equal(harness.form.confirmationPending, false)
  assert.equal(harness.form.enviando, false)
  assert.equal(harness.form.draft.nombre, DRAFT.nombre)
  harness.form.updateField('nombre', 'Nombre corregido')
  harness.render()
  assert.equal(harness.form.draft.nombre, 'Nombre corregido')
  assert.equal(harness.storage.peek(`qms-public-reclamacion:${TOKEN}`), null)
})
test('capacidad vencida impide reintentar archivos sin emitir otra solicitud', async () => {
  let now = Date.now()
  class ClockDate extends Date { static now() { return now } }
  const harness = hookHarness((call) => call.url === '/api/drive/upload-public' ? response({}, 502) : ordinaryHandler(call), { Date: ClockDate })
  harness.fill()
  harness.form.agregarArchivos([attachment()])
  harness.render()
  await harness.form.submit()
  harness.render()
  now += 31 * 60 * 1000
  const before = harness.calls.length
  await harness.form.retryPending()
  harness.render()
  assert.equal(harness.calls.length, before)
  assert.match(harness.form.error, /plazo.*venció/)
  assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
})

function textContent(element) {
  if (element == null || typeof element === 'boolean') return ''
  if (Array.isArray(element)) return element.map(textContent).join(' ')
  if (typeof element !== 'object') return String(element)
  return textContent(element.props?.children)
}
function pageHarness(query, form = {}) {
  let token = TOKEN
  const effects = [], focusCalls = []
  const api = client(() => { throw new Error('La vista no debe llamar red directamente') })
  const { default: Page } = loadModule('app/q/[token]/page.tsx', {
    react: { useRef: value => ({ current: value }), useEffect: effect => effects.push(effect) },
    'next/navigation': { useParams: () => ({ token }) },
    '@/lib/queries/useFormularioPublico': { useFormularioPublico: () => query },
    '@/app/q/components/usePublicQuejaForm': { usePublicQuejaForm: () => ({ archivos: [], draft: DRAFT, ...form }) },
    '@/lib/services/publicQuejasClient': api,
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Field': { default: 'Field' },
    '@/components/ui/Input': { default: 'Input' },
    '@/components/ui/Select': { default: 'Select' },
    '@/components/ui/Textarea': { default: 'Textarea' },
    '@/components/ui/LoadingSkeleton': { default: 'LoadingSkeleton' },
    'lucide-react': { X: 'X', Upload: 'Upload', CircleCheck: 'CircleCheck' },
  }, { document: { getElementById: id => ({
    focus: options => focusCalls.push({ action: 'focus', id, options }),
    scrollIntoView: options => focusCalls.push({ action: 'scroll', id, options }),
  }) } })
  return { api, query, Page, focusCalls, setToken(next) { token = next }, render() {
    const root = Page()
    const rendered = root.type(root.props)
    for (const effect of effects.splice(0)) effect()
    return rendered
  } }
}

test('503 muestra un estado de servicio limpio y un token nuevo remonta otra visita', () => {
  const view = pageHarness({ isPending: false, data: undefined, isFetching: false })
  view.query.error = new view.api.PublicRequestError(503)
  const rendered = textContent(view.render())
  assert.match(rendered, /Servicio no disponible/)
  assert.match(rendered, /Reintentar/)
  assert.doesNotMatch(rendered, /Correo electrónico|Registro de queja|Seleccionar categoría/)
  const firstVisit = view.Page()
  view.setToken('another-synthetic-form')
  const nextVisit = view.Page()
  assert.notEqual(firstVisit.key, nextVisit.key)
  assert.equal(nextVisit.props.token, 'another-synthetic-form')
})


function elementsOfType(element, type) {
  if (element == null || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(child => elementsOfType(child, type));
  return [...(element.type === type ? [element] : []), ...elementsOfType(element.props?.children, type)];
}

for (const scenario of [
  { name: 'subida en curso', enviando: true, finalized: false, status: 'subiendo' },
  { name: 'finalización pendiente', enviando: false, finalized: false, status: 'subido' },
  { name: 'evidencia fallida', enviando: false, finalized: true, status: 'fallido' },
  { name: 'operación aún en curso tras finalizar', enviando: true, finalized: true, status: 'subido' },
]) {
  test(`la confirmación final espera mientras hay ${scenario.name}`, () => {
    const view = pageHarness({ data: { nombre: 'Formulario sintético', uploadsAllowed: true } }, {
      receipt: receipt({ submissionId: 'synthetic-submission' }),
      archivos: [{ uploadId: 'synthetic-upload', file: { name: 'evidencia.pdf', size: 32 }, status: scenario.status }],
      enviando: scenario.enviando, finalized: scenario.finalized, etapa: 'Adjuntando evidencias…', error: '',
    });
    const rendered = view.render();
    assert.equal(elementsOfType(rendered, 'form').length, 1);
    assert.match(textContent(rendered), /Registro de queja/);
    assert.match(textContent(rendered), /Q-SYNTHETIC-001/);
  });
}

test('todos los adjuntos y la finalización confirmados muestran la tarjeta final con el folio', () => {
  const view = pageHarness({ data: { nombre: 'Formulario sintético', uploadsAllowed: true } }, {
    receipt: receipt({ submissionId: 'synthetic-submission' }),
    archivos: [{ uploadId: 'synthetic-upload', file: { name: 'evidencia.pdf', size: 32 }, status: 'subido' }],
    finalized: true, enviando: false, error: '',
  });
  const rendered = view.render();
  assert.equal(elementsOfType(rendered, 'form').length, 0);
  assert.match(textContent(rendered), /Queja registrada/);
  assert.match(textContent(rendered), /Q-SYNTHETIC-001/);
  assert.match(textContent(rendered), /Evidencias adjuntadas:\s+1\s+de\s+1/);
  assert.match(textContent(rendered), /Gestión de Calidad revisará tu queja/);
  assert.match(textContent(rendered), /El correo de confirmación puede tardar unos minutos/);
  assert.doesNotMatch(textContent(rendered), /Registro de queja|Reintentar|Subiendo|Envío completado|correo enviado/i);
});

test('un folio confirmado permanece visible aunque falle la siguiente lectura de metadata', () => {
  const view = pageHarness({ isPending: false, data: undefined, error: new Error('lectura fallida') }, {
    receipt: receipt({ submissionId: 'synthetic-submission' }), finalized: true, enviando: false, error: '',
  })
  const rendered = textContent(view.render())
  assert.match(rendered, /Queja registrada/)
  assert.match(rendered, /Q-SYNTHETIC-001/)
  assert.match(rendered, /Conservalo para tus consultas/)
  assert.doesNotMatch(rendered, /Servicio no disponible/)
})

test('el recibo ofrece solo el enlace privado confirmado y conserva el reintento separado del envío', async () => {
  const trackingUrl = 'https://qms.example.test/q/seguimiento#clave=synthetic.private_link'
  const base = { receipt: receipt({ submissionId: 'synthetic-submission' }), finalized: true, enviando: false, error: '' }
  const available = pageHarness({}, { ...base, trackingState: 'available', trackingUrl }).render()
  const link = elementsOfType(available, 'a').find(element => textContent(element) === 'Consultar mi trámite')
  assert.equal(link.props.href, trackingUrl)
  assert.equal(link.props.referrerPolicy, 'no-referrer')
  assert.doesNotMatch(textContent(available), /Obtener enlace de seguimiento|correo enviado/i)

  let retries = 0
  const pending = pageHarness({}, { ...base, trackingState: 'pending', retryingTracking: false, retryTracking: async () => { retries++ } }).render()
  const retry = elementsOfType(pending, 'Button').find(element => textContent(element) === 'Obtener enlace de seguimiento')
  assert.ok(retry)
  assert.match(textContent(pending), /sin repetir el envío ni los adjuntos/)
  assert.equal(elementsOfType(pending, 'form').length, 0)
  assert.equal(elementsOfType(pending, 'a').length, 0)
  await retry.props.onClick()
  assert.equal(retries, 1)

  const disabled = pageHarness({}, { ...base, trackingState: 'disabled' }).render()
  assert.doesNotMatch(textContent(disabled), /Seguimiento privado|Consultar mi trámite|Obtener enlace|correo enviado/i)
  assert.equal(elementsOfType(disabled, 'a').length, 0)
})
test('honeypot autocompletado se recupera sin cambiar el ID ni los datos persistidos', async () => {
  let attempts = 0
  const harness = hookHarness(call => {
    if (call.url !== '/api/public/quejas') return response({ ok: true })
    const body = JSON.parse(call.options.body)
    if (++attempts === 1) return response({ code: 'honeypot_rejected' }, 403)
    return response(receipt(body))
  })
  harness.fill(); harness.form.setHoneypot('synthetic-autofill'); harness.render()
  await harness.form.submit(); harness.render()
  assert.equal(harness.form.honeypot, '')
  await harness.form.submit(); harness.render()
  const calls = harness.calls.filter(call => call.url === '/api/public/quejas').map(call => JSON.parse(call.options.body))
  assert.equal(calls[0].submissionId, calls[1].submissionId)
  assert.equal(calls[0].honeypot, 'synthetic-autofill'); assert.equal(calls[1].honeypot, '')
  const { honeypot: firstHoney, ...first } = calls[0], { honeypot: secondHoney, ...second } = calls[1]
  assert.notEqual(firstHoney, secondHoney); assert.deepEqual(first, second)
  assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
})

test('respuesta perdida seguida de rechazo conserva identidad y borrador en todos los reintentos', async () => {
  let attempts = 0
  const harness = hookHarness(call => {
    if (call.url !== '/api/public/quejas') return response({ ok: true })
    if (++attempts === 1) throw new TypeError('fetch failed after uncertain commit')
    if (attempts === 2) return response({ code: 'verification_failed' }, 403)
    if (attempts === 3) return response({ code: 'invalid_public_request' }, 422)
    return response(receipt(JSON.parse(call.options.body)))
  })
  harness.fill(); harness.form.setHoneypot('synthetic-autofill'); harness.render()
  for (let i = 0; i < 4; i++) { await harness.form.submit(); harness.render(); harness.form.updateField('nombre', 'different name must not replace pending draft'); harness.render() }
  const bodies = harness.calls.filter(call => call.url === '/api/public/quejas').map(call => JSON.parse(call.options.body))
  assert.equal(new Set(bodies.map(body => body.submissionId)).size, 1)
  assert.equal(bodies.every(body => body.nombre === DRAFT.nombre), true)
  assert.equal(bodies[2].honeypot, ''); assert.equal(bodies[3].honeypot, '')
  assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
})

test('error por campo permite corregir y conserva el adjunto original sin duplicar envíos', async () => {
  let attempts = 0
  const harness = hookHarness(call => {
    if (call.url === '/api/public/quejas' && ++attempts === 1) return response({ code: 'invalid_public_nombre', error: 'SYNTHETIC_PRIVATE_DIAGNOSTIC' }, 400)
    return ordinaryHandler(call)
  })
  harness.fill()
  harness.form.agregarArchivos([attachment()]); harness.render()
  const uploadId = harness.form.archivos[0].uploadId
  await harness.form.submit(); harness.render()
  assert.equal(harness.form.invalidField.field, 'nombre')
  assert.equal(harness.form.confirmationPending, false)
  assert.equal(harness.form.enviando, false)
  assert.equal(harness.form.receipt, null)
  assert.equal(harness.form.archivos[0].uploadId, uploadId)
  assert.equal(harness.form.archivos[0].status, 'pendiente')
  assert.equal(harness.calls.length, 1)
  assert.doesNotMatch(harness.form.error, /PRIVATE|DIAGNOSTIC/)
  harness.form.updateField('nombre', 'Persona sintética corregida'); harness.render()
  assert.equal(harness.form.invalidField, null)
  assert.equal(harness.form.error, '')
  assert.equal(harness.form.draft.nombre, 'Persona sintética corregida')
  assert.equal(harness.form.archivos[0].uploadId, uploadId)
  const saving = harness.form.submit()
  const duplicate = harness.form.submit()
  await Promise.all([saving, duplicate]); harness.render()
  const bodies = harness.calls.filter(call => call.url === '/api/public/quejas').map(call => JSON.parse(call.options.body))
  assert.equal(bodies.length, 2)
  assert.notEqual(bodies[0].submissionId, bodies[1].submissionId)
  assert.equal(bodies[1].nombre, 'Persona sintética corregida')
  assert.equal(harness.calls.filter(call => call.url === '/api/drive/upload-public').length, 1)
  assert.equal(harness.calls.find(call => call.url === '/api/drive/upload-public').options.body.get('uploadId'), uploadId)
  assert.equal(harness.form.finalized, true)
})

test('validación local identifica el campo antes de red y permite corregir conservando adjuntos', async () => {
  const harness = hookHarness(ordinaryHandler)
  harness.fill({ ...DRAFT, email: 'uno,dos@example.test' })
  harness.form.agregarArchivos([attachment()]); harness.render()
  const uploadId = harness.form.archivos[0].uploadId
  await harness.form.submit(); harness.render()
  assert.equal(harness.calls.length, 0)
  assert.equal(harness.form.invalidField.field, 'email')
  assert.equal(harness.form.confirmationPending, false)
  assert.equal(harness.form.archivos[0].uploadId, uploadId)
  harness.form.updateField('email', DRAFT.email); harness.render()
  assert.equal(harness.form.invalidField, null)
  assert.equal(harness.form.error, '')
  await harness.form.submit(); harness.render()
  assert.equal(harness.form.finalized, true)
})

test('la vista enfoca el campo inválido y conserva su vínculo accesible al mensaje', () => {
  const view = pageHarness({ data: { nombre: 'Formulario sintético', uploadsAllowed: true } }, {
    invalidField: { field: 'email' }, error: 'Ingresá un correo electrónico válido.', enviando: false, confirmationPending: false,
  })
  const rendered = view.render()
  assert.equal(elementsOfType(rendered, 'form')[0].props.noValidate, true)
  const input = elementsOfType(rendered, 'Input').find(element => element.props.id === 'public-email')
  assert.equal(input.props['aria-invalid'], true)
  assert.equal(input.props['aria-describedby'], 'public-email-error')
  assert.equal(input.props.disabled, false)
  assert.equal(view.focusCalls.length, 2)
  assert.equal(view.focusCalls[0].action, 'focus')
  assert.equal(view.focusCalls[0].id, 'public-email')
  assert.equal(view.focusCalls[0].options.preventScroll, true)
  assert.equal(view.focusCalls[1].action, 'scroll')
  assert.equal(view.focusCalls[1].options.block, 'nearest')
  for (const state of [{ enviando: true }, { confirmationPending: true }]) {
    const locked = pageHarness({ data: { nombre: 'Formulario sintético', uploadsAllowed: true } }, {
      invalidField: { field: 'email' }, error: 'Correo inválido.', ...state,
    })
    const lockedInput = elementsOfType(locked.render(), 'Input').find(element => element.props.id === 'public-email')
    assert.equal(lockedInput.props.disabled, true)
    assert.equal(locked.focusCalls.length, 0)
  }
})

test('seguimiento pendiente se recupera sin recrear queja ni subir otra vez los adjuntos', async () => {
  const pending = deferred()
  let finalizations = 0
  const privateLink = 'https://qms.example.test/q/seguimiento#clave=synthetic.payload'
  const harness = hookHarness(call => {
    if (call.url.endsWith('/finalizar')) return ++finalizations === 1 ? response({ trackingState: 'pending' }) : pending.promise
    return ordinaryHandler(call)
  })
  harness.fill(); harness.form.agregarArchivos([attachment()]); harness.render()
  await harness.form.submit(); harness.render()
  assert.equal(harness.form.finalized, true)
  assert.equal(harness.form.trackingState, 'pending')
  assert.equal(harness.form.trackingUrl, null)
  const folio = harness.form.receipt.folio
  const retrieving = harness.form.retryTracking()
  const duplicate = harness.form.retryTracking()
  harness.render()
  assert.equal(harness.form.finalized, true)
  assert.equal(harness.form.enviando, false)
  assert.equal(harness.form.retryingTracking, true)
  assert.equal(finalizations, 2)
  pending.resolve(response({ trackingState: 'available', trackingUrl: privateLink }))
  await Promise.all([retrieving, duplicate]); harness.render()
  assert.equal(harness.form.trackingState, 'available')
  assert.equal(harness.form.trackingUrl, privateLink)
  assert.equal(harness.form.receipt.folio, folio)
  assert.equal(harness.calls.filter(call => call.url === '/api/public/quejas').length, 1)
  assert.equal(harness.calls.filter(call => call.url === '/api/drive/upload-public').length, 1)
  assert.equal(new Set(harness.calls.filter(call => call.url.endsWith('/finalizar')).map(call => call.options.body)).size, 1)
  await harness.form.retryTracking(); harness.render()
  assert.equal(finalizations, 2)
})

test('recuperar enlace aborta al salir y no publica la respuesta tardía', async () => {
  const pending = deferred()
  let finalizations = 0
  const harness = hookHarness(call => call.url.endsWith('/finalizar')
    ? ++finalizations === 1 ? response({ trackingState: 'pending' }) : pending.promise : ordinaryHandler(call))
  harness.fill(); await harness.form.submit(); harness.render()
  const retrieving = harness.form.retryTracking()
  harness.unmount()
  assert.equal(harness.calls.at(-1).options.signal.aborted, true)
  pending.resolve(response({ trackingState: 'available', trackingUrl: 'https://qms.example.test/q/seguimiento#clave=synthetic.payload' }))
  await retrieving; harness.render()
  assert.equal(harness.form.trackingUrl, null)
  assert.equal(harness.form.trackingState, 'pending')
})

test('la finalización mantiene compatibilidad y rechaza estado o enlace incoherentes', async () => {
  for (const [body, expected] of [[{ ok: true }, 'disabled'], [{ trackingState: 'pending' }, 'pending'],
    [{ trackingUrl: 'https://qms.example.test/q/seguimiento#clave=synthetic.payload' }, 'available']]) {
    assert.equal((await client(async () => response(body)).finalizarQuejaPublica(CAPABILITY)).trackingState, expected)
  }
  for (const body of [{ trackingState: 'available' }, { trackingState: 'invalid' },
    { trackingState: 'disabled', trackingUrl: 'https://qms.example.test/q/seguimiento#clave=synthetic.payload' },
    { trackingState: 'available', trackingUrl: 'javascript:alert(1)' }]) {
    await assert.rejects(client(async () => response(body)).finalizarQuejaPublica(CAPABILITY))
  }
})

const CHAVE_RECLAMACION = `qms-public-reclamacion:${TOKEN}`

test('la reclamación persiste el intento: una respuesta perdida seguida de recarga reenvía el mismo ID', async () => {
  const storage = storageShim()
  const first = hookHarness(() => { throw new TypeError('Failed to fetch') }, {}, storage)
  first.fill()
  await first.form.submit()
  first.render()
  const claimed = JSON.parse(storage.peek(CHAVE_RECLAMACION))
  assert.match(claimed.submissionId, /^[0-9a-f-]{36}$/)
  assert.ok(!claimed.receipt)

  const second = hookHarness(ordinaryHandler, {}, storage)
  assert.equal(second.form.receipt, null)
  await second.form.submit()
  second.render()
  const bodies = second.calls.filter((call) => call.url === '/api/public/quejas').map((call) => JSON.parse(call.options.body))
  assert.equal(bodies.length, 1)
  assert.equal(bodies[0].submissionId, claimed.submissionId)
  assert.equal(second.form.receipt.folio, 'Q-SYNTHETIC-001')
  assert.equal(JSON.parse(storage.peek(CHAVE_RECLAMACION)).receipt.folio, 'Q-SYNTHETIC-001')
})

test('un folio confirmado sobrevive la recarga y bloquea otra creación del mismo enlace', async () => {
  const storage = storageShim()
  const first = hookHarness(ordinaryHandler, {}, storage)
  first.fill()
  await first.form.submit()
  first.render()
  assert.equal(first.form.receipt.folio, 'Q-SYNTHETIC-001')

  const second = hookHarness(ordinaryHandler, {}, storage)
  assert.equal(second.form.receipt.folio, 'Q-SYNTHETIC-001')
  assert.equal(second.form.finalized, true)
  await second.form.submit()
  second.render()
  await second.form.retryPending()
  second.render()
  assert.equal(second.calls.filter((call) => call.url === '/api/public/quejas').length, 0)
  assert.equal(second.form.finalized, true)
})

test('la reclamación vencida o corrupta se descarta y el formulario arranca limpio', () => {
  const storage = storageShim()
  storage.setItem(CHAVE_RECLAMACION, '{ no-soy-json')
  const corrupt = hookHarness(ordinaryHandler, {}, storage)
  assert.equal(corrupt.form.receipt, null)
  assert.equal(corrupt.form.draft.nombre, '')

  storage.setItem(CHAVE_RECLAMACION, JSON.stringify({ v: 1, submissionId: 'no-es-uuid#' }))
  const invalid = hookHarness(ordinaryHandler, {}, storage)
  assert.equal(invalid.form.receipt, null)
  assert.equal(invalid.form.draft.nombre, '')
})

test('sin almacenamiento disponible el envío completo sigue funcionando', async () => {
  const brokenStorage = { getItem() { throw new Error('sin almacenamiento') }, setItem() { throw new Error('sin almacenamiento') }, removeItem() { throw new Error('sin almacenamiento') } }
  const harness = hookHarness(ordinaryHandler, {}, brokenStorage)
  harness.fill()
  await harness.form.submit()
  harness.render()
  assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
  assert.equal(harness.form.finalized, true)
})

test('un rechazo 400 sobre la reclamación restituida conserva el ID y no habilita otra queja', async () => {
  const storage = storageShim()
  const first = hookHarness(() => { throw new TypeError('Failed to fetch') }, {}, storage)
  first.fill()
  await first.form.submit()
  first.render()
  const claimed = JSON.parse(storage.peek(CHAVE_RECLAMACION))

  const second = hookHarness(call => call.url === '/api/public/quejas' && ++attempts === 1 ? response({ code: 'invalid_public_request' }, 400) : ordinaryHandler(call), {}, storage)
  let attempts = 0
  await second.form.submit()
  second.render()
  const body = JSON.parse(second.calls[0].options.body)
  assert.equal(body.submissionId, claimed.submissionId)
  await second.form.submit()
  second.render()
  assert.equal(second.form.receipt.folio, 'Q-SYNTHETIC-001')
  assert.equal(second.calls.filter((call) => call.url === '/api/public/quejas').length, 2)
})

for (const status of [400, 422]) {
  test(`un ${status} genérico después del alta conserva el envío largo y recupera un único folio`, async () => {
    const committed = new Map()
    let attempts = 0
    const harness = hookHarness(call => {
      if (call.url !== '/api/public/quejas') return ordinaryHandler(call)
      const input = JSON.parse(call.options.body)
      if (!committed.has(input.submissionId)) committed.set(input.submissionId, receipt(input))
      if (++attempts === 1) return response({ code: 'invalid_public_request' }, status)
      return response(committed.get(input.submissionId))
    })
    const longDescription = ('Lorem ipsum dolor sit amet.\n').repeat(370).slice(0, 10000)
    harness.fill({ ...DRAFT, descripcion: longDescription })
    harness.form.agregarArchivos([attachment()]); harness.render()
    const uploadId = harness.form.archivos[0].uploadId
    await harness.form.submit(); harness.render()
    assert.equal(committed.size, 1)
    assert.equal(harness.form.confirmationPending, true)
    assert.equal(harness.form.invalidField, null)
    assert.match(harness.form.error, /confirmar el registro.*mismo envío/)
    assert.doesNotMatch(harness.form.error, /Revisá los datos del formulario/)
    harness.form.updateField('descripcion', 'No debe reemplazar el envío registrado')
    harness.form.quitarArchivo(uploadId); harness.render()
    assert.equal(harness.form.draft.descripcion, longDescription.trim())
    assert.equal(harness.form.archivos[0].uploadId, uploadId)
    const retry = harness.form.submit()
    const duplicate = harness.form.submit()
    await Promise.all([retry, duplicate]); harness.render()
    const creates = harness.calls.filter(call => call.url === '/api/public/quejas')
    assert.equal(creates.length, 2)
    assert.equal(creates[0].options.body, creates[1].options.body)
    assert.equal(committed.size, 1)
    assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
    assert.equal(harness.form.finalized, true)
    const uploads = harness.calls.filter(call => call.url === '/api/drive/upload-public')
    assert.equal(uploads.length, 1)
    assert.equal(uploads[0].options.body.get('uploadId'), uploadId)
  })
}

test('confirmación 201 incompleta preserva el ID y el contenido al reintentar', async () => {
  let attempts = 0
  const harness = hookHarness(call => call.url === '/api/public/quejas' && ++attempts === 1
    ? response({ folio: 'Q-SYNTHETIC-001' }, 201) : ordinaryHandler(call))
  harness.fill()
  await harness.form.submit(); harness.render()
  assert.equal(harness.form.confirmationPending, true)
  await harness.form.submit(); harness.render()
  const creates = harness.calls.filter(call => call.url === '/api/public/quejas')
  assert.equal(creates.length, 2)
  assert.equal(creates[0].options.body, creates[1].options.body)
  assert.equal(harness.form.finalized, true)
})

test('un rechazo de campo posterior a una respuesta incierta nunca libera el intento ya reclamado', async () => {
  let attempts = 0
  const harness = hookHarness(call => {
    if (call.url !== '/api/public/quejas') return ordinaryHandler(call)
    if (++attempts === 1) return response({ code: 'invalid_public_request' }, 400)
    if (attempts === 2) return response({ code: 'invalid_public_descripcion' }, 422)
    return ordinaryHandler(call)
  })
  harness.fill()
  for (let index = 0; index < 3; index++) {
    await harness.form.submit(); harness.render()
    if (index < 2) assert.equal(harness.form.confirmationPending, true)
    harness.form.updateField('descripcion', 'Otro dato no puede crear un folio distinto'); harness.render()
  }
  const creates = harness.calls.filter(call => call.url === '/api/public/quejas')
  assert.equal(creates.length, 3)
  assert.equal(new Set(creates.map(call => call.options.body)).size, 1)
  assert.equal(harness.form.receipt.folio, 'Q-SYNTHETIC-001')
})

test('recargar tras un rechazo genérico mantiene la confirmación pendiente y recupera el mismo envío', async () => {
  const storage = storageShim()
  const first = hookHarness(() => response({ code: 'invalid_public_request' }, 400), {}, storage)
  first.fill(); await first.form.submit(); first.render(); first.unmount()
  const claimed = JSON.parse(storage.peek(CHAVE_RECLAMACION))
  const second = hookHarness(ordinaryHandler, {}, storage)
  assert.equal(second.form.confirmationPending, true)
  second.form.updateField('nombre', 'No cambiar reclamación'); second.render()
  assert.equal(second.form.draft.nombre, DRAFT.nombre)
  await second.form.submit(); second.render()
  const creates = second.calls.filter(call => call.url === '/api/public/quejas')
  assert.equal(creates.length, 1)
  assert.equal(JSON.parse(creates[0].options.body).submissionId, claimed.submissionId)
  assert.equal(second.form.finalized, true)
})

test('el límite de descripción se aplica antes de red y acepta exactamente 10000 caracteres', async () => {
  const harness = hookHarness(ordinaryHandler)
  harness.fill({ ...DRAFT, descripcion: 'L'.repeat(10001) })
  await harness.form.submit(); harness.render()
  assert.equal(harness.calls.length, 0)
  assert.equal(harness.form.invalidField.field, 'descripcion')
  harness.form.updateField('descripcion', 'L'.repeat(10000)); harness.render()
  await harness.form.submit(); harness.render()
  assert.equal(harness.form.finalized, true)
  assert.equal(JSON.parse(harness.calls[0].options.body).descripcion.length, 10000)
})
