import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

// Los eventos y estados son del componente real; red, sesión y editor pesado son dobles locales.
function fixture({ rol = 'colaborador', actividad = [] } = {}) {
  const slots = [], calls = [], locks = [], errors = []
  let cursor = 0, changed = false, tree, queja = null, closed = 0
  const user = { id: 'owner', rol }
  const react = {
    useEffect() {}, useCallback: value => value,
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i] },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; changed = true } }] },
  }
  const { default: Panel } = loadModule('app/mis-quejas/components/QuejaColaboradorPanel.tsx', {
    react,
    '@/components/Modal': { default: 'Modal' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Badge': { default: 'Badge' },
    '@/components/ui/RichTextEditor': { default: 'Editor' },
    '@/components/ui/RichTextContent': { default: 'Content' },
    '@/components/ui/DeferredMount': { default: 'DeferredMount' },
    '@/components/ui/Tabs': { default: 'Tabs' },
    '@/components/quejas/ListaAdjuntos': { default: 'Attachments' },
    '@/components/quejas/AdjuntoPreviewModal': { default: 'Preview' },
    '@/components/usuarios/ConfirmDialog': { default: 'Confirm' },
    '@/lib/store/auth-store': { useAuthStore: select => select({ user }) },
    '@/lib/services/errorToast': { showError: (...args) => errors.push(args), showSuccess() {} },
    '@/lib/services/quejaWorkflowService': { transicionarQueja: async (...args) => { calls.push(args); throw new Error('conflicto sintético') } },
    '@/lib/queries/useQuejaActividad': { useQuejaActividad: () => ({ data: actividad, isLoading: false, error: null, refetch() {} }), useCrearQuejaActividad: () => ({ mutateAsync: async () => {} }) },
    '@/lib/queries/useQuejas': { useQuejaAdjuntos: () => ({ data: [{ id: 'file', usuario_id: 'owner', nombre: 'Informe.pdf' }] }) },
    '@/lib/queries/useQuejaSeguimiento': { useQuejaPlazos: () => ({}) },
    '@/hooks/useEntityRequestGuard': { useEntityRequestGuard: () => ({ invalidate() {}, captureContext: () => () => true, start: () => ({ isCurrent: () => true, finish() {} }) }) },
    '@/hooks/useQuejaAttachmentActions': { useQuejaAttachmentActions: () => ({ previewAdjunto: null, confirmarEliminacion: null }) },
    '@/app/mis-quejas/components/useQuejaAssistant': { useQuejaAssistant: () => ({ aiResult: '', chat: [], chatInput: '', setAiResult() {}, setChatInput() {}, handleAnalisisAuto() {}, handleEnviarIA() {}, setModoEdicion() {} }) },
  })
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children), ...visit(value.props.headerActions), ...visit(value.props.compact), ...visit(value.props.cycle), ...visit(value.props.action), ...visit(value.props.request)] : []
  const nodes = () => visit(tree)
  const text = value => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
  function render() { do { changed = false; cursor = 0; tree = Panel({ queja, onClose: () => closed++, onUpdated() {}, onNavigationLockChange: lock => locks.push(lock), onPrevious() {}, onNext() {} }) } while (changed) }
  return {
    calls, errors, nodes, render,
    select(id, extra = {}) { queja = id ? { id, folio: '2026-001', cliente_nombre: 'Persona sintética', fecha: '2026-10-15', categoria: 'Queja', estado: 'En Investigación', responsable_id: 'owner', revision: 7, ...extra } : null; render() },
    tab(value) { nodes().find(node => node.type === 'Tabs').props.onChange(value); render() },
    modal: () => nodes().find(node => node.type === 'Modal'),
    button: label => nodes().find(node => node.type === 'Button' && (node.props['aria-label'] === label || text(node) === label)),
    editor: () => nodes().find(node => node.type === 'Editor' && !nodes().some(parent => parent.props.hidden && visit(parent.props.children).includes(node))),
    closed: () => closed,
  }
}

test('Mis Quejas comparte workspace ampliable; cerrar y volver a abrir restablece lateral', () => {
  const panel = fixture()
  panel.select('A')
  assert.equal(panel.modal().props.variant, 'workspace')
  assert.equal(panel.modal().props.expanded, false)
  panel.button('Ampliar expediente').props.onClick(); panel.render()
  assert.equal(panel.modal().props.expanded, true)
  panel.modal().props.onClose(); panel.render()
  assert.equal(panel.closed(), 1)
  assert.equal(panel.modal().props.expanded, false)
  panel.select(null); panel.select('A')
  assert.equal(panel.modal().props.expanded, false)
})

test('Mis Quejas comparte el marco y el ciclo horizontal de Quejas', () => {
  const panel = fixture()
  panel.select('A')
  const workspace = () => panel.nodes().find(node => node.type.name === 'CaseWorkspace')
  const assertSharedLayout = () => {
    const current = workspace()
    assert.equal(current.props.cyclePlacement, 'top')
    assert.equal(current.props.request.type.name, 'CaseRequestHeader')
    assert.equal(current.props.presentation, 'reference')
    assert.equal(current.props.request.props.variant, 'details')
    assert.equal(current.props.request.props.reference, true)
    assert.equal(current.props.cycle.type.name, 'CaseCycle')
    assert.equal(current.props.cycle.props.process, true)
    assert.equal(current.props.cycle.props.distribute, undefined)
    const compactCycle = panel.nodes().find(node => node.type.name === 'CaseCycle' && node !== current.props.cycle)
    assert.equal(compactCycle.props.currentOnly, true)
    assert.equal(compactCycle.props.process, true)
    assert.equal(panel.nodes().some(node => node.type === 'AreaCatalog'), false)
  }
  assertSharedLayout()
  panel.tab('resolucion')
  assertSharedLayout()
})

test('el editor de resolución mantiene lienzo documental, formato explícito y límite persistible', () => {
  const panel = fixture()
  panel.select('A'); panel.tab('resolucion')
  assert.equal(panel.editor().props.variant, 'document')
  assert.equal(panel.editor().props.layout, 'fill')
  assert.equal(panel.editor().props.maxLength, 10000)
  assert.equal(panel.editor().props.format, 'plain')
  assert.equal(panel.editor().props.className, 'mis-quejas-resolution-editor')
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, true)
})

test('la devolución de Calidad se muestra desde el panel lateral de Mis Quejas', () => {
  const reason = 'Falta documentar la evidencia revisada.'
  const panel = fixture({ actividad: [
    { id: 'return-note', tipo: 'nota', descripcion: `Devuelta a investigación. Motivo: ${reason}`, created_at: '2026-11-05T12:00:00Z' },
  ] })
  panel.select('A', { estado: 'En Investigación' })
  const viewNote = panel.button('Ver nota de devolución')
  assert.ok(viewNote)
  viewNote.props.onClick(); panel.render()
  assert.equal(panel.button('Ocultar nota de devolución').props['aria-expanded'], true)
  const note = panel.nodes().find(node => node.props.id === 'queja-A-nota-devolucion')
  assert.ok(note)
  assert.match(JSON.stringify(note.props.children), new RegExp(reason))
  assert.doesNotMatch(JSON.stringify(note.props.children), /Devuelta a investigación\. Motivo:/)
})

test('la propuesta captura revisión al editar y conserva borrador y formato ante conflicto', async () => {
  const panel = fixture()
  panel.select('A'); panel.tab('resolucion')
  panel.editor().props.onChange('**Conclusión sintética**', 'markdown'); panel.render()
  panel.select('A', { revision: 99 })
  await panel.button('Enviar a Revisión GC').props.onClick(); panel.render()
  assert.equal(panel.calls.length, 1)
  assert.equal(panel.calls[0][0].revision, 7)
  assert.equal(panel.calls[0][1], 'Pendiente de Revisión GC')
  assert.equal(panel.calls[0][2].resolucionFormato, 'markdown')
  assert.equal(panel.editor().props.value, '**Conclusión sintética**')
})

test('una lectura reasignada retira el editor y nunca ejecuta su envío anterior', async () => {
  const panel = fixture()
  panel.select('A'); panel.tab('resolucion')
  panel.editor().props.onChange('Conclusión', 'plain'); panel.render()
  panel.select('A', { responsable_id: 'other' })
  assert.equal(panel.editor(), undefined)
  assert.equal(panel.button('Enviar a Revisión GC'), undefined)
  assert.equal(panel.calls.length, 0)
})

test('una propuesta en revisión es de lectura y no permite aprobar desde Mis Quejas', () => {
  const panel = fixture()
  panel.select('A', { estado: 'Pendiente de Revisión GC', resolucion: 'Trabajo sintético' }); panel.tab('resolucion')
  assert.equal(panel.editor(), undefined)
  assert.equal(panel.button('Enviar a Revisión GC'), undefined)
  assert.equal(panel.button('Confirmar resolución'), undefined)
  assert.ok(panel.nodes().some(node => node.type === 'Content' && node.props.value === 'Trabajo sintético'))
})

test('coincidir con el responsable no habilita edición para roles ajenos al workflow', () => {
  for (const rol of ['direccion', 'auditor', 'lector']) {
    const panel = fixture({ rol })
    panel.select('A'); panel.tab('resolucion')
    assert.equal(panel.editor(), undefined)
    assert.equal(panel.button('Enviar a Revisión GC'), undefined)
    panel.tab('resolucion')
    assert.equal(panel.button('Análisis IA').props.disabled, true)
    assert.equal(panel.calls.length, 0)
  }
})

test('asistencia secundaria no reemplaza el lienzo y las evidencias mantienen tarjetas sin miniaturas', () => {
  const panel = fixture()
  panel.select('A'); panel.tab('resolucion')
  assert.equal(panel.button('Análisis IA').props.variant, 'ghost')
  assert.equal(panel.editor().props.label, 'Conclusión de la investigación')
  assert.equal(panel.editor().props.layout, 'fill')
  assert.equal(panel.nodes().filter(node => node.type === 'Editor').length, 1)
  const navigation = panel.nodes().find(node => node.type === 'Tabs').props.items
  assert.deepEqual(Array.from(navigation, tab => tab.label), ['Análisis', 'Resolución'])
  const files = panel.nodes().filter(node => node.type === 'Attachments')
  assert.ok(files.every(node => node.props.layout === 'cards'))
  assert.equal(panel.nodes().filter(node => node.type === 'img').length, 0)
})

test('abrir asistencia conserva las pestañas y el borrador; cerrar la visita restablece la ayuda', () => {
  const panel = fixture()
  panel.select('A'); panel.tab('resolucion')
  const assistance = () => panel.nodes().find(node => node.props['data-resolution-assistance'] !== undefined)
  const header = () => panel.nodes().find(node => node.props['data-resolution-header'] !== undefined)
  assert.equal(assistance().props.hidden, true)
  const toggle = panel.button('Asistencia para la resolución')
  assert.equal(toggle.props['aria-controls'], assistance().props.id)
  toggle.props.onClick(); panel.render()
  assert.equal(assistance().props.hidden, false)
  assert.equal(panel.button('Asistencia para la resolución').props['aria-expanded'], true)
  assert.equal(header().props.children.includes(assistance()), false)
  panel.editor().props.onChange('Conclusión en curso', 'plain'); panel.render()
  panel.button('Asistencia para la resolución').props.onClick(); panel.render()
  assert.equal(assistance().props.hidden, true)
  assert.equal(panel.editor().props.value, 'Conclusión en curso')
  panel.button('Asistencia para la resolución').props.onClick(); panel.render()
  panel.modal().props.onClose(); panel.render()
  panel.tab('resolucion')
  assert.equal(assistance().props.hidden, true)
})

test('los estados de lectura y una reasignación retiran la asistencia interactiva', () => {
  const panel = fixture()
  panel.select('A'); panel.tab('resolucion')
  panel.button('Asistencia para la resolución').props.onClick(); panel.render()
  for (const estado of ['Recibido', 'Pendiente de Revisión GC', 'Resuelto', 'Finalizado', 'No Procede']) {
    panel.select('A', { estado })
    assert.equal(panel.button('Asistencia para la resolución'), undefined)
    assert.equal(panel.nodes().find(node => node.props['data-resolution-assistance'] !== undefined).props.hidden, true)
    assert.equal(panel.editor(), undefined)
  }
  panel.select('B'); panel.tab('resolucion')
  assert.equal(panel.nodes().find(node => node.props['data-resolution-assistance'] !== undefined).props.hidden, true)
  panel.button('Asistencia para la resolución').props.onClick(); panel.render()
  panel.select('B', { responsable_id: 'other' })
  assert.equal(panel.button('Asistencia para la resolución'), undefined)
  assert.equal(panel.editor(), undefined)
})

test('borrador de resolución bloquea navegación y permanece al cambiar pestañas', () => {
  const panel = fixture()
  panel.select('A'); panel.tab('resolucion')
  panel.editor().props.onChange('Borrador', 'plain'); panel.render()
  assert.equal(panel.button('Queja siguiente').props.disabled, true)
  panel.tab('detalle'); panel.tab('resolucion')
  assert.equal(panel.editor().props.value, 'Borrador')
})
