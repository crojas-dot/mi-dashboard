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
const queryContexts = loadModule('lib/queries/queryContextScope.ts')

function panelHarness(kind = 'colaborador') {
  const slots = [], pendingEffects = new Map(), requests = [], updates = [], invalidations = [], toasts = []
  let cursor = 0, changed = false, tree, entity
  const guards = []
  const queryClient = { invalidateQueries: ({ queryKey }) => invalidations.push(queryKey) }
  const invalidateContext = queryContexts.activateQueryContext(queryClient)
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
    useMemo: (create) => create(),
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
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
  const { default: Panel } = loadModule(kind === 'colaborador' ? 'app/mis-quejas/components/QuejaColaboradorPanel.tsx' : 'app/quejas/components/QuejaDetalleModal.tsx', {
    react,
    '@tanstack/react-query': { useQueryClient: () => queryClient },
    '@/lib/queries/queryContextScope': queryContexts,
    '@/components/Modal': { default: 'Modal' },
    '@/components/ui/Select': { default: 'Select' },
    '@/lib/queries/useUsuarios': { useUsuarios: () => ({ data: [{ id: 'owner', nombre: 'Responsable', rol: 'colaborador' }] }) },
    '@/lib/queries/useQuejaComentarios': { useQuejaComentarios: () => ({}), useCrearQuejaComentario: () => ({ mutateAsync: (input) => request('comment', input) }) },    './QuejaColaboradorPanel.module.css': { default: {} },    '@/components/ui/Badge': { default: 'Badge' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/quejas/AdjuntoPreviewModal': { default: 'Preview' },
    '@/components/quejas/ListaAdjuntos': { default: 'Attachments' },
    '@/components/usuarios/ConfirmDialog': { default: 'Confirm' },
    'react-markdown': { default: 'Markdown' },
    '@/lib/services/errorToast': { showError: (...args) => toasts.push(args), showSuccess: (...args) => toasts.push(args) },
    '@/lib/store/auth-store': { useAuthStore: (select) => select({ user: { id: 'user', rol: kind === 'colaborador' ? 'colaborador' : 'admin' } }) },
    '@/lib/queries/useQuejaActividad': { useQuejaActividad: () => ({}), useCrearQuejaActividad: () => ({ mutateAsync: (input) => request('note', input) }) },
    '@/lib/queries/useQuejas': { useQuejaAdjuntos: () => ({}), quejaAdjuntosKey: (id) => ['attachments', id] },
    '@/lib/services/quejaWorkflowService': {
      transicionarQueja: (...input) => request('transition', input),
      actualizarDetallesQueja: (...input) => request('details', input),
      derivarQuejaASACP: (...input) => request('derive', input),
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
      tree = Panel({ queja: entity, prioridades: [], categorias: [], onUpdated: (update, guard) => { updates.push(update); guards.push(guard) }, onClose: () => {} })
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
    requests, updates, guards, invalidations, toasts, render, nodes, button, invalidateContext,
    select(id, overrides = {}) { entity = id ? { id, folio: id, cliente_nombre: id, revision: 4, estado: 'En Investigación', fecha: '2026-09-01', prioridad: 'Media', categoria: 'Queja', ...overrides } : null; render() },
    tab(label) { nodes().find((node) => node.type === 'button' && text(node).trim() === label).props.onClick(); render() },
    input(placeholder, value) { nodes().find((node) => node.type === 'textarea' && node.props.placeholder?.includes(placeholder)).props.onChange({ target: { value } }); render() },
    contents: () => text(tree),
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}

test('IA de A no rellena B ni apaga su solicitud nueva; A → B → A sigue siendo otra visita', async () => {
  const panel = panelHarness()
  panel.select('A'); panel.tab('Análisis')
  const first = panel.button('Análisis IA').props.onClick()
  panel.select('B')
  panel.select('A')
  const current = panel.button('Análisis IA').props.onClick()
  panel.requests[0].resolve('RESPUESTA ANTIGUA')
  await first
  panel.render()
  assert.doesNotMatch(panel.contents(), /RESPUESTA ANTIGUA/)
  assert.equal(panel.button('Análisis IA').props.loading, true)
  panel.requests[1].resolve('RESPUESTA VIGENTE')
  await current
  panel.render()
  assert.match(panel.contents(), /RESPUESTA VIGENTE/)
  assert.equal(panel.button('Análisis IA').props.loading, false)
})

test('cerrar y desmontar impide publicar respuestas y errores IA tardíos', async () => {
  for (const action of ['close', 'unmount']) {
    const panel = panelHarness()
    panel.select('A'); panel.tab('Análisis')
    const pending = panel.button('Análisis IA').props.onClick()
    if (action === 'close') panel.nodes().find((node) => node.props['aria-label'] === 'Cerrar panel de queja').props.onClick()
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
  panel.requests[0].resolve({ id: 'A', estado: 'Pendiente de Revisión GC', resolucion: 'Resolución A' })
  await first
  panel.render()
  assert.deepEqual({ ...panel.updates[0] }, { id: 'A', estado: 'Pendiente de Revisión GC', resolucion: 'Resolución A' })
  assert.equal(panel.nodes().find((node) => node.type === 'textarea').props.value, 'Borrador B')
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


test('el bloqueo síncrono rechaza dobles envíos y una visita vieja no libera el actual', () => {
  const { createRequestScope } = loadModule('lib/utils/requestScope.ts')
  const scope = createRequestScope()
  assert.equal(scope.start('write'), null)
  scope.activate()
  const first = scope.start('write')
  assert.ok(first)
  assert.equal(scope.start('write'), null)
  scope.invalidate(); scope.activate()
  const current = scope.start('write')
  first.finish()
  assert.equal(scope.start('write'), null)
  assert.equal(first.isCurrent(), false)
  assert.equal(current.isCurrent(), true)
  current.finish()
  assert.ok(scope.start('write'))
})

test('el contexto exige registro y los tokens no reviven tras cleanup/setup ni A → otro → A', () => {
  const clientA = {}, clientB = {}
  assert.equal(queryContexts.captureQueryContext(clientA)(), false)
  const closeA = queryContexts.activateQueryContext(clientA)
  const oldA = queryContexts.captureQueryContext(clientA)
  assert.equal(oldA(), true)
  closeA()
  const closeB = queryContexts.activateQueryContext(clientB)
  assert.equal(oldA(), false)
  closeB()
  const closeNewA = queryContexts.activateQueryContext(clientA)
  const newA = queryContexts.captureQueryContext(clientA)
  assert.equal(oldA(), false)
  assert.equal(newA(), true)
  closeA() // Un cleanup atrasado tampoco puede cerrar el setup actual.
  assert.equal(newA(), true)
  closeNewA()
  assert.equal(newA(), false)
})

test('QueryProvider invalida el contexto antes de limpiar datos y renueva tokens en StrictMode', () => {
  const effects = []
  const { default: Provider } = loadModule('lib/providers/QueryProvider.tsx', {
    react: { useState: (create) => [create()], useEffect: (effect) => effects.push(effect) },
    '@/lib/store/auth-store': { useAuthStore: (select) => select({ user: { id: 'A', rol: 'admin' }, vistaActiva: 'calidad' }) },
    '@/lib/queries/queryContextScope': queryContexts,
  }, { process: { env: { NODE_ENV: 'test' } } })
  const scoped = Provider({ children: null })
  const client = scoped.type(scoped.props).props.client
  const firstCleanups = effects.map(effect => effect())
  const first = queryContexts.captureQueryContext(client)
  assert.equal(first(), true)
  const clear = client.clear.bind(client)
  let cleared = 0
  client.clear = () => { cleared++; assert.equal(first(), false); clear() }
  for (const cleanup of firstCleanups) cleanup?.()
  assert.equal(cleared, 1)
  const nextCleanups = effects.map(effect => effect())
  const current = queryContexts.captureQueryContext(client)
  assert.equal(first(), false)
  assert.equal(current(), true)
  for (const cleanup of nextCleanups) cleanup?.()
  assert.equal(current(), false)
})

test('la selección rechaza otra visita, otro ID y revisiones inferiores al ejecutar el updater', () => {
  const { updateSelectedQueja } = loadModule('lib/utils/quejaSelection.ts')
  const current = { id: 'A', revision: 8 }
  const updated = { id: 'A', revision: 9 }
  assert.equal(updateSelectedQueja(current, updated, () => false), current)
  assert.equal(updateSelectedQueja({ id: 'B', revision: 1 }, updated)?.id, 'B')
  assert.equal(updateSelectedQueja(current, { id: 'A', revision: 7 }), current)
  assert.equal(updateSelectedQueja(current, updated, () => true), updated)
  assert.equal(updateSelectedQueja(null, updated), null)
})

test('la escritura de otra visita de A notifica el origen y entrega un guard que impide reemplazar la selección', async () => {
  const panel = panelHarness()
  panel.select('A'); panel.tab('Resolución'); panel.input('Documentá la conclusión', 'Primera visita')
  const pending = panel.button('Enviar a Revisión GC').props.onClick()
  panel.select('B'); panel.select('A')
  panel.input('Documentá la conclusión', 'Nueva visita')
  panel.requests[0].resolve({ id: 'A', revision: 5 })
  await pending; panel.render()
  assert.equal(panel.updates[0].id, 'A')
  assert.equal(panel.guards[0](), false)
  assert.equal(panel.nodes().find(node => node.type === 'textarea').props.value, 'Nueva visita')
})

for (const kind of ['colaborador', 'detalle']) {
  test(kind + ': subir dos veces en el mismo tick envía un solo archivo', async () => {
    const panel = panelHarness(kind)
    panel.select('A')
    if (kind === 'colaborador') panel.tab('Análisis')
    const input = panel.nodes().find(node => node.type === 'input' && node.props.type === 'file')
    for (const name of ['uno.txt', 'dos.txt']) input.props.onChange({ target: { files: [new File(['x'], name)], value: '' } })
    assert.equal(panel.requests.length, 1)
    panel.requests[0].resolve()
    await new Promise(resolve => setImmediate(resolve)); panel.render()
    assert.deepEqual(Array.from(panel.invalidations[0]), ['attachments', 'A'])
    assert.equal(panel.nodes().find(node => node.type === 'input' && node.props.type === 'file').props.disabled, false)
  })

  test(kind + ': navegar/desmontar conserva invalidación de A; cambiar ámbito la descarta', async () => {
    for (const endContext of [false, true]) {
      const panel = panelHarness(kind)
      panel.select('A')
      if (kind === 'colaborador') panel.tab('Análisis')
      panel.nodes().find(node => node.type === 'input' && node.props.type === 'file').props.onChange({ target: { files: [new File(['x'], 'archivo.txt')], value: '' } })
      panel.unmount()
      if (endContext) panel.invalidateContext()
      panel.requests[0].resolve()
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(panel.invalidations.length, endContext ? 0 : 1)
      assert.equal(panel.toasts.length, 0)
    }
  })

  test(kind + ': borrar o descargar no publica errores ni cierra confirmaciones de otra visita', async () => {
    const panel = panelHarness(kind)
    panel.select('A')
    const download = panel.nodes().find(node => node.type === 'Attachments')
    // Los datos de esta fixture se inyectan vía la consulta en las pruebas específicas de archivos.
    assert.equal(download, undefined)
    panel.select('B')
    assert.equal(panel.toasts.length, 0)
  })
}

test('un conflicto conserva resolución y revisión editadas sin reintentar ni doble enviar', async () => {
  const panel = panelHarness()
  panel.select('A', { revision: 17 }); panel.tab('Resolución'); panel.input('Documentá la conclusión', 'Borrador')
  const submit = panel.button('Enviar a Revisión GC').props.onClick
  const first = submit(), duplicate = submit()
  assert.equal(panel.requests.length, 1)
  assert.equal(panel.requests[0].input[0].revision, 17)
  panel.requests[0].reject(Object.assign(new Error('conflicto'), { code: '40001' }))
  await Promise.all([first, duplicate]); panel.render()
  assert.equal(panel.requests.length, 1)
  assert.equal(panel.nodes().find(node => node.type === 'textarea').props.value, 'Borrador')
  assert.equal(panel.button('Enviar a Revisión GC').props.loading, false)
})

for (const kind of ['colaborador', 'detalle']) {
  test(kind + ': escribir otro borrador con el mismo texto durante el guardado no lo elimina', async () => {
    const panel = panelHarness(kind)
    panel.select('A')
    if (kind === 'colaborador') panel.tab('Análisis')
    const placeholder = kind === 'colaborador' ? 'Registrá un avance' : 'Nuevo comentario'
    const label = kind === 'colaborador' ? ' Agregar nota' : ' Agregar'
    panel.input(placeholder, 'Mismo texto')
    const pending = panel.button(label).props.onClick()
    panel.input(placeholder, ''); panel.input(placeholder, 'Mismo texto')
    panel.requests[0].resolve()
    await pending; panel.render()
    assert.equal(panel.nodes().find(node => node.props.placeholder?.includes(placeholder)).props.value, 'Mismo texto')
  })
}

test('detalle: transición de A no limpia la resolución ni el loading de B', async () => {
  const panel = panelHarness('detalle')
  panel.select('A'); panel.button('Resolver').props.onClick(); panel.render()
  panel.input('Análisis / Resolución Final', 'Resolución A')
  const first = panel.button('Confirmar resolución').props.onClick()
  panel.select('B'); panel.button('Resolver').props.onClick(); panel.render()
  panel.input('Análisis / Resolución Final', 'Resolución B')
  const current = panel.button('Confirmar resolución').props.onClick()
  panel.requests[0].resolve({ id: 'A', revision: 5, estado: 'Resuelto' })
  await first; panel.render()
  assert.equal(panel.updates[0].id, 'A')
  assert.equal(panel.guards[0](), false)
  assert.equal(panel.nodes().find(node => node.props.placeholder?.includes('Análisis / Resolución Final')).props.value, 'Resolución B')
  assert.equal(panel.button('Confirmar resolución').props.loading, true)
  panel.requests[1].resolve({ id: 'B', revision: 5, estado: 'Resuelto' })
  await current; panel.render()
  assert.equal(panel.button('Confirmar resolución').props.loading, false)
})

test('detalle: fallo tardío de comentario de A conserva el envío y borrador de B', async () => {
  const panel = panelHarness('detalle')
  panel.select('A'); panel.input('Nuevo comentario', 'Comentario A')
  const first = panel.button(' Agregar').props.onClick()
  panel.select('B'); panel.input('Nuevo comentario', 'Comentario B')
  const current = panel.button(' Agregar').props.onClick()
  panel.requests[0].reject(new Error('falló A'))
  await first; panel.render()
  assert.equal(panel.toasts.length, 0)
  assert.equal(panel.button(' Agregar').props.loading, true)
  assert.equal(panel.nodes().find(node => node.props.placeholder?.includes('Nuevo comentario')).props.value, 'Comentario B')
  panel.requests[1].resolve()
  await current; panel.render()
  assert.equal(panel.button(' Agregar').props.loading, false)
})

test('notas y comentarios invalidan su origen al navegar y omiten ámbitos terminados', async () => {
  for (const kind of ['nota', 'comentario']) {
    const invalidations = []
    const client = { invalidateQueries: ({ queryKey }) => invalidations.push(queryKey) }
    const close = queryContexts.activateQueryContext(client)
    const isContextCurrent = queryContexts.captureQueryContext(client)
    const mocks = {
      '@tanstack/react-query': { useQueryClient: () => client, useMutation: options => options },
      '@/lib/supabase': { supabase: { from: () => ({ insert: async () => ({ error: null }) }), rpc: async () => ({ data: {}, error: null }) } },
    }
    const module = loadModule(kind === 'nota' ? 'lib/queries/useQuejaActividad.ts' : 'lib/queries/useQuejaComentarios.ts', mocks)
    const mutation = kind === 'nota' ? module.useCrearQuejaActividad() : module.useCrearQuejaComentario()
    const input = { quejaId: 'A', descripcion: 'Nota', comentario: 'Comentario', tipo: 'interno', visibleCliente: false, isContextCurrent }
    const result = await mutation.mutationFn(input)
    mutation.onSuccess(result, input)
    assert.equal(invalidations.length, 1)
    assert.equal(invalidations[0].at(-1), 'A')
    close()
    mutation.onSuccess(result, input)
    assert.equal(invalidations.length, 1)
  }
})
