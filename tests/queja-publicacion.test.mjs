import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const quejaId = randomUUID(), otherId = randomUUID()
const archivo = (patch = {}) => ({ id: randomUUID(), queja_id: quejaId, usuario_id: randomUUID(),
  nombre: 'Oficio definitivo.pdf', storage_path: 'fixture_official_drive_file_001', tamano: 2048,
  tipo_mime: 'application/pdf', created_at: '2026-10-15T10:00:00Z', ...patch })
function serviceFixture(error = null) {
  const calls = []
  const service = loadModule('lib/services/quejaWorkflowService.ts', { '@/lib/supabase': { supabase: {
    rpc: async (name, args) => { calls.push({ name, args }); return { data: { id: args.p_queja_id, revision: args.p_expected_revision + 1 }, error } },
  } } })
  return { service, calls }
}

test('publicación exige respuesta explícita/oficio/archivo institucional propio antes del RPC', async () => {
  const { service, calls } = serviceFixture(), file = archivo()
  const valid = { estado: 'Resuelto', respuestaPublica: 'Respuesta oficial', numeroOficio: 'ECA-GC-2026-001', adjunto: file }
  for (const patch of [{ respuestaPublica: '' }, { respuestaPublica: ' '.repeat(10) }, { respuestaPublica: 'x'.repeat(10001) },
    { numeroOficio: '' }, { numeroOficio: 'x'.repeat(121) }, { adjunto: null },
    { adjunto: archivo({ queja_id: otherId }) }, { adjunto: archivo({ usuario_id: null }) },
    { adjunto: archivo({ storage_path: 'private/path/legacy.pdf' }) }, { adjunto: archivo({ id: 'bad' }) },
    { adjunto: archivo({ tamano: null }) }, { adjunto: archivo({ tamano: 0 }) }, { adjunto: archivo({ tamano: 4194305 }) },
    { adjunto: archivo({ nombre: '' }) }, { adjunto: archivo({ nombre: 'x'.repeat(256) }) },
    { adjunto: archivo({ nombre: 'carpeta/oficio.pdf' }) }, { adjunto: archivo({ nombre: 'oficio\n.pdf' }) },
    { adjunto: archivo({ tipo_mime: null }) }, { adjunto: archivo({ tipo_mime: 'bad-mime' }) },
    { adjunto: archivo({ tipo_mime: 'application/' + 'x'.repeat(120) }) },
    { estado: 'Finalizado' }, { resolucion: 'x'.repeat(10001) }]) {
    assert.throws(() => service.resolverQuejaConDocumento({ id: quejaId, revision: 7 }, { ...valid, ...patch }))
  }
  assert.equal(calls.length, 0)
  await service.resolverQuejaConDocumento({ id: quejaId, revision: 7 }, { ...valid, respuestaPublica: '  Respuesta oficial  ',
    resolucion: '**Nota interna**', resolucionFormato: 'markdown' })
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { name: 'qms_resolve_complaint_with_document', args: {
    p_queja_id: quejaId, p_estado: 'resolved', p_expected_revision: 7,
    p_detalles: { resolution: '**Nota interna**', resolution_format: 'markdown', office_number: 'ECA-GC-2026-001' },
    p_adjunto_id: file.id, p_respuesta_publica: 'Respuesta oficial',
  } })
  await service.resolverQuejaConDocumento({ id: quejaId, revision: 8 }, { ...valid, estado: 'No Procede' })
  assert.equal(calls[1].args.p_estado, 'rejected')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].args.p_detalles)), { office_number: 'ECA-GC-2026-001' })
})

test('un conflicto de publicación no obtiene otra revisión ni fuerza reintentos', async () => {
  const conflict = { code: '40001', message: 'Conflicto sintético' }, { service, calls } = serviceFixture(conflict)
  const valid = { estado: 'Resuelto', respuestaPublica: 'Respuesta', numeroOficio: 'ECA-GC-2026-001', adjunto: archivo() }
  await assert.rejects(service.resolverQuejaConDocumento({ id: quejaId, revision: 3 }, valid), value => value === conflict)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].args.p_expected_revision, 3)
  assert.throws(() => service.resolverQuejaConDocumento({ id: quejaId, revision: undefined }, valid), /Actualiza el expediente/)
})

test('consulta de disponibilidad lleva cancelación/cache seguro y no interpreta error como modo antiguo', async () => {
  const calls = [], controller = new AbortController()
  let response = Response.json({ enabled: true })
  const queries = loadModule('lib/queries/useQuejaPublicacion.ts', {
    '@/lib/services/apiClient': { apiFetch: async (...args) => { calls.push(args); return response } },
    '@tanstack/react-query': { useQuery: value => value },
  })
  assert.equal(await queries.fetchPublicacionQuejasDisponible(controller.signal), true)
  assert.equal(calls[0][0], '/api/quejas/seguimiento')
  assert.equal(calls[0][1].signal, controller.signal)
  assert.equal(calls[0][1].cache, 'no-store')
  response = Response.json({ enabled: false })
  assert.equal(await queries.fetchPublicacionQuejasDisponible(), false)
  for (const bad of [Response.json({ error: 'unavailable' }, { status: 503 }), Response.json({ enabled: 'false' }), Response.json(null)]) {
    response = bad
    await assert.rejects(queries.fetchPublicacionQuejasDisponible(), /No se pudo comprobar/)
  }
  const hook = queries.usePublicacionQuejasDisponible(false)
  assert.equal(hook.enabled, false)
  assert.deepEqual(Array.from(hook.queryKey), ['quejas', 'publicacion-disponible'])
})

function panelFixture(options = {}) {
  let cursor = 0, changed = false, tree, entity, generation = 0, availability = { data: true }, uploading = false
  const slots = [], requests = [], toasts = [], updates = [], locks = new Set()
  const service = serviceFixture().service
  const files = [archivo(), archivo({ queja_id: otherId }), archivo({ usuario_id: null }), archivo({ storage_path: 'legacy/file.pdf' })]
  const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
  const mutation = (kind, ...args) => { const pending = deferred(); requests.push({ kind, args, ...pending }); return pending.promise }
  const react = { useEffect() {}, useMemo: create => create(),
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value
        if (!Object.is(next, slots[index])) { slots[index] = next; changed = true } }] },
  }
  const { default: Panel } = loadModule('app/quejas/components/QuejaDetalleModal.tsx', {
    '@/app/quejas/components/QuejaInformeModal': { default: 'Informe' },
    '@/app/quejas/components/QuejaRespuestaClienteModal': { default: 'Response' },
    react, '@/components/Modal': { default: 'Modal' }, '@/components/ui/Button': { default: 'Button' },
    '@/app/quejas/components/AreaQuejaCatalogo': { default: 'AreaCatalog' },
    '@/components/ui/Input': { default: 'Input' }, '@/components/ui/Select': { default: 'Select' }, '@/components/ui/Textarea': { default: 'Textarea' },
    '@/components/ui/RichTextEditor': { default: 'Editor' }, '@/components/ui/RichTextContent': { default: 'Content' },
    '@/app/quejas/components/AreaQuejaControl': { default: 'AreaControl' }, '@/app/quejas/components/ResponsablePicker': { default: 'ResponsablePicker' },
    '@/components/quejas/AdjuntoPreviewModal': { default: 'Preview' }, '@/components/quejas/ListaAdjuntos': { default: 'Files' }, '@/components/usuarios/ConfirmDialog': { default: 'Confirm' },
    '@/lib/store/auth-store': { useAuthStore: select => select({ user: { id: 'staff', rol: options.role ?? 'calidad' } }) },
    '@/lib/queries/useUsuarios': { useUsuarios: () => ({ data: [] }) },
    '@/lib/queries/useQuejaComentarios': { useQuejaComentarios: () => ({}), useCrearQuejaComentario: () => ({}) },
    '@/lib/queries/useQuejaActividad': { useQuejaActividad: () => ({}) },
    '@/lib/queries/useQuejaSeguimiento': { useQuejaPlazos: () => ({}), useQuejaCorreos: () => ({}) },
    '@/lib/queries/useQuejaPublicacion': { usePublicacionQuejasDisponible: () => availability },
    '@/lib/queries/useQuejas': { useQuejaAdjuntos: () => ({ data: files.filter(file => file.queja_id === entity?.id), refetch() {} }) },
    '@/hooks/useEntityRequestGuard': { useEntityRequestGuard: () => ({ invalidate() { generation++ },
      captureContext: () => () => true, start(key) { if (locks.has(key)) return null; locks.add(key); const visit = generation
        return { isCurrent: () => visit === generation, finish: () => locks.delete(key) } } }) },
    '@/hooks/useQuejaAttachmentActions': { useQuejaAttachmentActions: () => ({ previewAdjunto: null,
      confirmarEliminacion: null, subiendoAdjunto: uploading, eliminandoAdjunto: null,
      handleSubirAdjunto: file => { requests.push({ kind: 'upload', file }); uploading = true }, setPreviewAdjunto() {} }) },
    '@/lib/services/quejaWorkflowService': { esOficioPublicableQueja: service.esOficioPublicableQueja,
      revisarResolucionQueja: (...args) => mutation('review', ...args),
      transicionarQueja: (...args) => mutation('legacy', ...args), resolverQuejaConDocumento: (...args) => mutation('publish', ...args) },
    '@/lib/services/errorToast': { showError: (_error, message) => toasts.push(message), showSuccess: message => toasts.push(message) },
  })
  const render = () => { do { cursor = 0; changed = false; tree = Panel({ queja: entity, onClose() {}, onUpdated: (...args) => updates.push(args) }) } while (changed) }
  const visit = value => {
    if (Array.isArray(value)) return value.flatMap(visit)
    if (!value?.props || value.props.hidden || value.type === 'Modal' && !value.props.open) return []
    if (typeof value.type === 'function' && ['QuejaPublicacionPanel', 'Tabs'].includes(value.type.name)) return visit(value.type(value.props))
    return [value, ...visit(value.props.children), ...visit(value.props.headerActions), ...visit(value.props.footer), ...visit(value.props.compact), ...visit(value.props.cycle), ...visit(value.props.action)]
  }
  const text = value => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
  const nodes = () => visit(tree)
  const button = label => nodes().find(node => ['Button', 'button'].includes(node.type) && text(node) === label)
  return { requests, toasts, updates, files, render, nodes, button,
    select(patch = {}) { if (entity?.id !== (patch.id ?? quejaId)) generation++; entity = { id: quejaId, folio: '2026-001',
      revision: 7, estado: 'Pendiente de Revisión GC', resolucion: 'Conclusión INTERNA', resolucion_formato: 'markdown',
      notas: 'SECRETO_INTERNO', numero_oficio_resolucion: 'ECA-GC-2026-001', ...patch }; render() },
    availability(value) { availability = value; render() },
    field(suffix, value) { const node = nodes().find(node => node.props.id?.endsWith(suffix) && node.props.onChange); assert.ok(node, suffix)
      node.props.onChange({ target: { value } }); render() },
    edit(value) { nodes().find(node => node.type === 'Editor').props.onChange(value, 'markdown'); render() },
    click(label) { const node = button(label); assert.ok(node, label); const result = node.props.onClick(); render(); return result },
  }
}

test('revisión GC prioriza la propuesta y conserva antecedentes íntegros sin escrituras', () => {
  const panel = panelFixture()
  const description = 'Relato ORIGINAL del cliente.\n\nSegunda parte sin reinterpretar.'
  panel.select({ descripcion: description, fecha: '2026-11-03T15:00:00Z', justificacion_procede: 'Decisión de procedencia', justificacion_procede_formato: 'plain' })
  const workspace = panel.nodes().find(node => node.type?.name === 'CaseWorkspace')
  assert.equal(workspace.props.cyclePlacement, 'top')
  const sections = panel.nodes().filter(node => node.type?.name === 'CaseSection' && node.props.variant === 'document')
  assert.equal(sections[0].props.title, 'Propuesta del responsable')
  const context = panel.nodes().find(node => Object.hasOwn(node.props, 'data-case-review-context'))
  assert.ok(context)
  assert.notEqual(context.props.open, true)
  assert.ok(panel.nodes().some(node => node.type === 'p' && node.props.children === description))
  assert.ok(panel.nodes().some(node => node.type === 'Content' && node.props.value === 'Conclusión INTERNA'))
  assert.equal(panel.requests.length, 0)
  panel.select({ estado: 'Recibido', descripcion: description })
  assert.equal(panel.nodes().find(node => node.type?.name === 'CaseWorkspace').props.cyclePlacement, 'top')
  assert.equal(panel.nodes().find(node => node.type?.name === 'CaseSection' && node.props.variant === 'document').props.title, 'Descripción')
  assert.equal(panel.nodes().find(node => Object.hasOwn(node.props, 'data-case-review-context')), undefined)
})

test('aprobar solo registra la revisión original y continúa a respuesta sin campos públicos', async () => {
  const panel = panelFixture(); panel.select()
  assert.equal(panel.nodes().filter(node => node.type === 'Textarea').length, 0)
  assert.equal(panel.nodes().filter(node => node.type === 'Input').length, 0)
  const pending = panel.click('Aprobar y continuar')
  panel.select({ revision: 99 })
  assert.equal(panel.requests[0].kind, 'review')
  assert.equal(panel.requests[0].args[0].revision, 7)
  assert.equal(panel.requests[0].args[1], 'approved')
  panel.requests[0].resolve({ id: quejaId, folio: '2026-001', estado: 'Resuelto', revision: 8 }); await pending; panel.render()
  assert.equal(panel.nodes().find(node => node.type === 'Response').props.queja.estado, 'Resuelto')
  assert.equal(panel.requests.length, 1)
})

test('rechazo abre la respuesta al cliente con revisión capturada; cancelar vuelve a decidir; false confirmado usa legacy', async () => {
  const panel = panelFixture(); panel.select({ estado: 'Recibido', numero_oficio_resolucion: '' })
  panel.click('Tomar decisión'); panel.click('No Procede')
  // Con publicación confirmada la justificación y el oficio se redactan dentro de la
  // respuesta al cliente; el panel no mantiene un editor ni campos públicos paralelos.
  assert.equal(panel.nodes().find(node => node.type === 'Editor'), undefined)
  const response = panel.nodes().find(node => node.type === 'Response')
  assert.equal(response.props.noProcede, true)
  assert.equal(response.props.queja.id, quejaId)
  assert.equal(response.props.queja.revision, 7)
  panel.select({ revision: 99 })
  assert.equal(panel.nodes().find(node => node.type === 'Response').props.queja.revision, 7)
  panel.nodes().find(node => node.type === 'Response').props.onClose(false); panel.render()
  assert.equal(panel.nodes().find(node => node.type === 'Response'), undefined)
  assert.ok(panel.button('No Procede')); assert.ok(panel.button('Procede'))
  assert.equal(panel.requests.length, 0)

  // Publicación false confirmada conserva el contrato legacy con justificación y oficio.
  const legacy = panelFixture(); legacy.availability({ data: false }); legacy.select({ estado: 'Recibido', numero_oficio_resolucion: '' })
  legacy.click('Tomar decisión'); legacy.click('No Procede'); legacy.edit('Justificación interna')
  await legacy.click('Guardar')
  assert.equal(legacy.requests.length, 0)
  assert.match(legacy.toasts.at(-1), /número del oficio/)
  legacy.field('-rechazo-' + quejaId, 'ECA-GC-2026-008')
  const pending = legacy.click('Guardar')
  assert.equal(legacy.requests[0].kind, 'legacy')
  assert.equal(legacy.requests[0].args[1], 'No Procede')
  legacy.requests[0].resolve({ id: quejaId, revision: 8 }); await pending

  const approve = panelFixture(); approve.availability({ data: false }); approve.select()
  const old = approve.click('Aprobar y continuar')
  assert.equal(approve.requests[0].kind, 'review')
  assert.equal(approve.requests[0].args[0].revision, 7)
  approve.requests[0].resolve({ id: quejaId, revision: 8 }); await old
})

test('flag público no confirmado bloquea publicación de No Procede; analista no aprueba', async () => {
  for (const availability of [{ isLoading: true }, { error: new Error('offline') }, {}]) {
    const panel = panelFixture(); panel.availability(availability); panel.select({ estado: 'Recibido' }); panel.click('Tomar decisión'); panel.click('No Procede'); panel.edit('Justificación')
    assert.equal(panel.button('Guardar').props.disabled, true)
    await panel.click('Guardar')
    assert.equal(panel.requests.length, 0)
  }
  const analyst = panelFixture({ role: 'colaborador' }); analyst.select({ estado: 'En Investigación', responsable_id: 'staff' })
  assert.equal(analyst.button('Resolver'), undefined)
})

test('cambiar de visita descarta la respuesta en curso y la nueva visita abre su propia decisión', () => {
  const panel = panelFixture(); panel.select({ estado: 'Recibido' })
  panel.click('Tomar decisión'); panel.click('No Procede')
  const first = panel.nodes().find(node => node.type === 'Response')
  assert.equal(first.props.queja.id, quejaId)
  // Cambiar de visita retira la respuesta de A: no queda editor ni modal de otra visita.
  panel.select({ id: otherId, estado: 'Recibido' })
  assert.equal(panel.nodes().find(node => node.type === 'Response'), undefined)
  assert.equal(panel.nodes().find(node => node.type === 'Editor'), undefined)
  panel.click('Tomar decisión'); panel.click('No Procede')
  const second = panel.nodes().find(node => node.type === 'Response')
  assert.equal(second.props.queja.id, otherId)
  assert.equal(second.props.noProcede, true)
  assert.notEqual(second, first)
  assert.equal(panel.requests.filter(request => request.kind === 'publish').length, 0)
})
