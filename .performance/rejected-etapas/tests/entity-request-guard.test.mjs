import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { loadModule } from './load-module.mjs'

function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

// Ejecuta los handlers reales y los efectos de commit; la red y el DOM son dobles locales.
// Las generaciones se invalidan por el hook real, también al cerrar/desmontar.
function panelHarness() {
  const slots = [], pendingEffects = new Map(), requests = [], updates = [], invalidations = [], toasts = []
  let cursor = 0, changed = false, tree, entity
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (value) => {
        const next = typeof value === 'function' ? value(slots[index]) : value
        if (!Object.is(next, slots[index])) { slots[index] = next; changed = true }
      }]
    },
    useCallback: (callback) => callback,
    useEffect() {},
    useLayoutEffect(effect, deps) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) pendingEffects.set(index, { effect, deps })
    },
  }
  const request = (kind, input) => {
    const pending = deferred()
    requests.push({ kind, input, ...pending })
    return pending.promise
  }
  const { default: Panel } = loadModule('app/mis-quejas/components/QuejaColaboradorPanel.tsx', {
    react,
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: ({ queryKey }) => invalidations.push(queryKey) }) },
    '@coreui/react': new Proxy({}, { get: (_target, key) => key }),
    './QuejaColaboradorPanel.module.css': { default: {} },
    '@/components/ui/icons': new Proxy({}, { get: (_target, key) => key }),
    '@/components/ui/Badge': { default: 'Badge' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/quejas/AdjuntoPreviewModal': { default: 'Preview' },
    '@/components/quejas/ListaAdjuntos': { default: 'Attachments' },
    '@/components/usuarios/ConfirmDialog': { default: 'Confirm' },
    'react-markdown': { default: 'Markdown' },
    '@/lib/services/errorToast': { showError: (...args) => toasts.push(args), showSuccess: (...args) => toasts.push(args) },
    '@/lib/store/auth-store': { useAuthStore: (select) => select({ user: { id: 'user', rol: 'colaborador' } }) },
    '@/lib/queries/useQuejaActividad': { useQuejaActividad: () => ({}), useCrearQuejaActividad: () => ({ mutateAsync: (input) => request('note', input) }) },
    '@/lib/queries/useQuejas': { useQuejaAdjuntos: () => ({}), quejaAdjuntosKey: (id) => ['attachments', id] },
    '@/lib/services/quejaWorkflowService': {
      transicionarQueja: (...input) => request('transition', input),
      subirAdjuntoQueja: (...input) => request('upload', input),
      eliminarAdjuntoQueja: (...input) => request('delete', input),
      descargarAdjuntoQueja: (...input) => request('download', input),
    },
    '@/lib/services/aiService': { analizarIA: (input) => request('ai', input) },
  }, { crypto: webcrypto })
  function render() {
    do {
      changed = false
      cursor = 0
      tree = Panel({ queja: entity, onUpdated: (update) => updates.push(update), onClose: () => {} })
    } while (changed)
    for (const [index, { effect, deps }] of pendingEffects) {
      slots[index]?.cleanup?.()
      slots[index] = { deps, cleanup: effect() }
    }
    pendingEffects.clear()
    return tree
  }
  function visit(value) {
    if (Array.isArray(value)) return value.flatMap(visit)
    return value?.props ? [value, ...visit(value.props.children)] : []
  }
  const nodes = () => visit(tree)
  function text(value) {
    if (Array.isArray(value)) return value.map(text).join('')
    return value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
  }
  const button = (label) => nodes().find((node) => ['Button', 'CButton'].includes(node.type) && text(node) === label)
  return {
    requests, updates, invalidations, toasts, render, nodes, button,
    select(id) { entity = id ? { id, folio: id, cliente_nombre: id, estado: 'En Investigación', estado_codigo: 'investigation', estado_nombre: 'Investigación en curso', estado_color: 'primary', revision: 7, fecha: '2026-09-01', prioridad: 'Media', categoria: 'Queja' } : null; render() },
    tab(label) { nodes().find((node) => node.type === 'CNavLink' && text(node) === label).props.onClick(); render() },
    input(placeholder, value) { nodes().find((node) => node.type === 'CFormTextarea' && node.props.placeholder?.includes(placeholder)).props.onChange({ target: { value } }); render() },
    contents: () => text(tree),
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}

test('IA de A no rellena B ni apaga su solicitud nueva; A → B → A sigue siendo otra visita', async () => {
  const panel = panelHarness()
  panel.select('A'); panel.tab('Análisis')
  const first = panel.button(' Generar análisis').props.onClick()
  panel.select('B')
  panel.select('A')
  const current = panel.button(' Generar análisis').props.onClick()
  panel.requests[0].resolve('RESPUESTA ANTIGUA')
  await first
  panel.render()
  assert.doesNotMatch(panel.contents(), /RESPUESTA ANTIGUA/)
  assert.equal(panel.button(' Generar análisis').props.loading, true)
  panel.requests[1].resolve('RESPUESTA VIGENTE')
  await current
  panel.render()
  assert.match(panel.contents(), /RESPUESTA VIGENTE/)
  assert.equal(panel.button(' Generar análisis').props.loading, false)
})

test('cerrar y desmontar impide publicar respuestas y errores IA tardíos', async () => {
  for (const action of ['close', 'unmount']) {
    const panel = panelHarness()
    panel.select('A'); panel.tab('Análisis')
    const pending = panel.button(' Generar análisis').props.onClick()
    if (action === 'close') panel.nodes().find((node) => node.props['aria-label'] === 'Cerrar panel').props.onClick()
    else panel.unmount()
    panel.requests[0].reject(new Error('respuesta tardía'))
    await pending
    assert.equal(panel.toasts.length, 0)
  }
})

test('fallo tardío del chat de A no elimina mensajes ni loading del chat de B', async () => {
  const panel = panelHarness()
  panel.select('A'); panel.tab('Análisis'); panel.input('Hacé una pregunta', 'Pregunta A')
  const first = panel.button(' Enviar').props.onClick()
  panel.select('B'); panel.input('Hacé una pregunta', 'Pregunta B')
  const current = panel.button(' Enviar').props.onClick()
  panel.requests[0].reject(new Error('falló A'))
  await first
  panel.render()
  assert.match(panel.contents(), /Pregunta B/)
  assert.equal(panel.button(' Enviar').props.loading, true)
  panel.requests[1].resolve('Respuesta B')
  await current
  panel.render()
  assert.match(panel.contents(), /Respuesta B/)
})

test('la transición confirmada actualiza A aunque se abra B, sin limpiar la resolución de B', async () => {
  const panel = panelHarness()
  panel.select('A'); panel.tab('Resolución'); panel.input('Documentá la conclusión', 'Resolución A')
  const first = panel.button('Enviar a Revisión GC').props.onClick()
  panel.select('B'); panel.input('Documentá la conclusión', 'Borrador B')
  panel.requests[0].resolve({ id: 'A', estado: 'Pendiente de Revisión GC', estado_codigo: 'quality_review', revision: 8, resolucion: 'Resolución A' })
  await first
  panel.render()
  assert.deepEqual({ ...panel.updates[0] }, { id: 'A', estado: 'Pendiente de Revisión GC', estado_codigo: 'quality_review', revision: 8, resolucion: 'Resolución A' })
  assert.equal(panel.nodes().find((node) => node.type === 'CFormTextarea').props.value, 'Borrador B')
})

test('subida tardía invalida adjuntos de A sin finalizar la subida que está activa en B', async () => {
  const panel = panelHarness()
  const upload = () => panel.nodes().find((node) => node.type === 'input' && node.props.type === 'file')
  panel.select('A'); panel.tab('Análisis')
  upload().props.onChange({ target: { files: [new File(['a'], 'a.txt')], value: '' } })
  panel.select('B')
  upload().props.onChange({ target: { files: [new File(['b'], 'b.txt')], value: '' } })
  panel.requests[0].resolve()
  await new Promise((resolve) => setImmediate(resolve))
  panel.render()
  assert.deepEqual(Array.from(panel.invalidations[0]), ['attachments', 'A'])
  assert.equal(upload().props.disabled, true)
  panel.requests[1].resolve()
  await new Promise((resolve) => setImmediate(resolve))
  panel.render()
  assert.equal(upload().props.disabled, false)
})

test('una nota enviada no elimina un borrador escrito durante la espera', async () => {
  const panel = panelHarness()
  panel.select('A'); panel.tab('Análisis'); panel.input('Registrá un avance', 'Primera nota')
  const pending = panel.button(' Agregar nota').props.onClick()
  panel.input('Registrá un avance', 'Próxima nota')
  panel.requests[0].resolve()
  await pending
  panel.render()
  assert.equal(panel.nodes().find((node) => node.props.placeholder?.includes('Registrá un avance')).props.value, 'Próxima nota')
})
