import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

// Los eventos y estados son del componente real; red, sesión y editor pesado son dobles locales.
function fixture({ rol = 'colaborador', actividad = [], workflowError = true, initialDraft = null, saveWait } = {}) {
  const slots = [], calls = [], locks = [], errors = [], uploads = [], updates = [], saves = [], noteUpdates = [], noteDeletes = []
  const drafts = new Map(initialDraft ? [[initialDraft.queja_id, initialDraft]] : [])
  let draftError = false, generation = 0, guardId, active = false
  const lanes = new Set()
  let cursor = 0, changed = false, tree, queja = null, closed = 0
  let uploading = false
  const user = { id: 'owner', rol }
  const react = {
    useEffect() {}, useCallback: value => value,
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i] },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; changed = true } }] },
  }
  const { default: Panel } = loadModule('app/mis-quejas/components/QuejaColaboradorPanel.tsx', {
    react,
    '@tanstack/react-query': { useQueryClient: () => ({ setQueryData: (key, value) => drafts.set(key.at(-1), value), invalidateQueries() {} }) },
    '@/components/Modal': { default: 'Modal' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Badge': { default: 'Badge' },
    '@/components/ui/RichTextEditor': { default: 'Editor' },
    '@/components/ui/RichTextContent': { default: 'Content' },
    '@/components/quejas/ListaAdjuntos': { default: 'Attachments' },
    '@/components/quejas/AdjuntoPreviewModal': { default: 'Preview' },
    '@/components/usuarios/ConfirmDialog': { default: 'Confirm' },
    '@/lib/store/auth-store': { useAuthStore: select => select({ user }) },
    '@/lib/services/errorToast': { showError: (...args) => errors.push(args), showSuccess() {} },
    '@/lib/services/quejaWorkflowService': {
      enviarResolucionBorradorRevision: async (q, version, resolucion, resolucionFormato) => { calls.push([q, 'Pendiente de Revisión GC', { version, resolucion, resolucionFormato }]); if (workflowError) throw new Error('conflicto sintético'); return { ...q, estado: 'Pendiente de Revisión GC', revision: q.revision + 1 } },
      guardarResolucionBorrador: async (q, version, contenido, formato) => {
        saves.push([q,version,contenido,formato]); if (saveWait) await saveWait
        if ((drafts.get(q.id)?.version ?? 0) !== version) throw new Error('Conflicto sintético de borrador')
        return { queja_id: q.id, version: version + 1, source_revision: q.revision, contenido, formato, actualizado_por: 'owner', updated_at: '2026-11-12T03:00:00Z' }
      },
    },
    '@/lib/services/quejaInvestigacionService': {
      actualizarNotaInvestigacion: async (nota, contenido) => { noteUpdates.push([nota, contenido]) },
      eliminarNotaInvestigacion: async nota => { noteDeletes.push(nota) },
    },
    '@/lib/queries/useQuejaResolucionDraft': { quejaResolucionDraftKey: id => ['quejas','resolucion-borrador',id], useQuejaResolucionDraft: id => ({ data: draftError ? undefined : drafts.get(id) ?? null, error: draftError ? new Error('Lectura fallida') : null, isFetching: false, refetch() {} }) },
    '@/lib/queries/useQuejaActividad': { quejaActividadKey: id => ['quejas', 'actividad', id], useQuejaActividad: () => ({ data: actividad, isLoading: false, error: null, refetch() {} }), useCrearQuejaActividad: () => ({ mutateAsync: async () => {} }) },
    '@/lib/queries/useQuejas': { useQuejaAdjuntos: () => ({ data: [{ id: 'client-file', usuario_id: null, nombre: 'Solicitud.pdf' }, { id: 'file', usuario_id: 'owner', nombre: 'Informe.pdf' }] }) },
    '@/lib/queries/useQuejaSeguimiento': { useQuejaPlazos: () => ({}) },
    '@/hooks/useEntityRequestGuard': { useEntityRequestGuard: id => {
      if (guardId !== id) { guardId = id; generation++; active = !!id; lanes.clear() }
      return { invalidate() { generation++; active = false; lanes.clear() }, captureContext: () => () => true, start(key) {
        if (!active || lanes.has(key)) return null
        const started = generation; lanes.add(key)
        const isCurrent = () => active && generation === started
        return { isCurrent, finish() { if (isCurrent()) lanes.delete(key) } }
      } }
    } },
    '@/hooks/useQuejaAttachmentActions': { useQuejaAttachmentActions: () => ({ previewAdjunto: null, confirmarEliminacion: null, subiendoAdjunto: uploading, eliminandoAdjunto: null, handleSubirAdjunto: async file => { uploads.push(file) }, setConfirmarEliminacion() {} }) },
    '@/app/mis-quejas/components/useQuejaAssistant': { useQuejaAssistant: () => ({ aiAutoLoading: false, chatLoading: false, aiResult: '', chat: [], chatInput: '', setAiResult() {}, setChatInput() {}, handleAnalisisAuto() {}, handleEnviarIA() {}, setModoEdicion() {} }) },
  }, { window: { getSelection: () => null, matchMedia: () => ({ matches: true }) }, requestAnimationFrame() {} })
  const visit = value => {
    if (Array.isArray(value)) return value.flatMap(visit)
    if (!value?.props) return []
    if (['QuejaInvestigacionResumen', 'QuejaAnalisisPanel', 'QuejaNotasCard', 'QuejaNotasPanel'].includes(value.type?.name)) return [value, ...visit(value.type(value.props))]
    if (value.type === 'Modal' && !value.props.open) return [value]
    return [value, ...visit(value.props.children), ...visit(value.props.headerActions), ...visit(value.props.footer), ...visit(value.props.compact), ...visit(value.props.cycle), ...visit(value.props.action), ...visit(value.props.request), ...visit(value.props.requestFooter)]
  }
  const nodes = () => visit(tree)
  const text = value => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
  function render() { do { changed = false; cursor = 0; tree = Panel({ queja, onClose: () => closed++, onUpdated: updated => updates.push(updated), onNavigationLockChange: lock => locks.push(lock), onPrevious() {}, onNext() {} }) } while (changed) }
  const button = label => nodes().find(node => node.type === 'Button' && (node.props['aria-label'] === label || text(node) === label))
  return {
    calls, errors, nodes, render, uploads, updates, saves, noteUpdates, noteDeletes,
    remoteDraft(id, value) { drafts.set(id, value); render() },
    draftError(value) { draftError = value; render() },
    select(id, extra = {}) { queja = id ? { id, folio: '2026-001', cliente_nombre: 'Persona sintética', fecha: '2026-10-15', categoria: 'Queja', estado: 'En Investigación', responsable_id: 'owner', revision: 7, ...extra } : null; render() },
    openAnalysis() { button('Ver caso completo').props.onClick(); render() },
    openNotes() { nodes().find(node => node.props['data-investigation-notes-card']).props.onClick(); render() },
    modal: () => nodes().find(node => node.type === 'Modal' && node.props.variant === 'workspace'),
    analysisModal: () => nodes().find(node => node.type === 'Modal' && node.props.title.startsWith('Análisis')),
    notesModal: () => nodes().find(node => node.type === 'Modal' && node.props.title.startsWith('Notas')),
    button,
    uploading(value) { uploading = value; render() },
    editor: () => nodes().find(node => node.type === 'Editor' && !nodes().some(parent => parent.props.hidden && visit(parent.props.children).includes(node))),
    closed: () => closed,
  }
}

test('Mis Quejas comparte workspace ampliable; cerrar y volver a abrir restablece lateral', () => {
  const panel = fixture()
  panel.select('A')
  assert.equal(panel.modal().props.expanded, false)
  panel.button('Ampliar expediente').props.onClick(); panel.render()
  assert.equal(panel.modal().props.expanded, true)
  panel.modal().props.onClose(); panel.render()
  assert.equal(panel.closed(), 1)
  assert.equal(panel.modal().props.expanded, false)
})

test('el trabajo conserva geometría, ciclo y editor integrado sin pestañas ni otro modal de escritura', () => {
  const panel = fixture()
  panel.select('A')
  const workspace = panel.nodes().find(node => node.type.name === 'CaseWorkspace')
  assert.equal(workspace.props.cyclePlacement, 'top')
  assert.equal(workspace.props.presentation, 'reference')
  assert.equal(workspace.props.request.type.name, 'CaseRequestHeader')
  assert.equal(workspace.props.requestFooter.type.name, 'QuejaNotasCard')
  assert.equal(workspace.props.cycle.props.process, true)
  assert.equal(panel.editor().props.label, 'Resolución')
  assert.equal(panel.editor().props.layout, 'fill')
  assert.equal(panel.editor().props.variant, 'document')
  assert.equal(panel.editor().props.maxLength, 10000)
  assert.equal(panel.editor().props.format, 'plain')
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, true)
  assert.equal(panel.nodes().filter(node => node.type === 'Editor').length, 1)
  assert.equal(panel.nodes().some(node => node.props.role === 'tab' || node.type === 'Modal' && node.props.open && node.props.variant === 'document'), false)
})

test('un único acceso abre Análisis en un modal amplio sin ampliar el trabajo ni perder el borrador', () => {
  const panel = fixture()
  panel.select('A', { justificacion_procede: 'Observación de Calidad registrada.' })
  const editorId = panel.editor().props.id
  assert.equal(panel.nodes().filter(node => node.type === 'Button' && node.props['aria-label'] === 'Ver caso completo').length, 1)
  panel.editor().props.onChange('Borrador en curso', 'plain'); panel.render()
  panel.openAnalysis()
  assert.equal(panel.modal().props.expanded, false)
  assert.equal(panel.analysisModal().props.open, true)
  assert.equal(panel.analysisModal().props.variant, 'document')
  assert.equal(panel.analysisModal().props.size, 'xl')
  const sections = panel.nodes().filter(node => node.type?.name === 'CaseSection').map(node => node.props.title)
  assert.ok(sections.indexOf('Observación de Calidad') < sections.indexOf('Descripción del cliente'))
  assert.equal(panel.nodes().find(node => node.type === 'Badge' && node.props.children === 'Procede').props.variant, 'blue')
  assert.equal(panel.editor().props.id, editorId)
  assert.equal(panel.editor().props.value, 'Borrador en curso')
  panel.analysisModal().props.onClose(); panel.render()
  assert.equal(panel.analysisModal().props.open, false)
  assert.equal(panel.editor().props.value, 'Borrador en curso')
})

test('el pie de Análisis vuelve al editor y conserva la amplitud anterior del trabajo', () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('Conclusión', 'plain'); panel.render()
  panel.button('Ampliar expediente').props.onClick(); panel.render()
  panel.openAnalysis()
  panel.button('Preparar resolución').props.onClick(); panel.render()
  assert.equal(panel.analysisModal().props.open, false)
  assert.equal(panel.modal().props.expanded, true)
  assert.equal(panel.editor().props.value, 'Conclusión')
})

test('la devolución previa exige el nombre de reenvío y oculta el mensaje mientras reenvía', () => {
  const panel = fixture({ actividad: [{ id: 'return', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: Falta documentar evidencia.', created_at: '2026-11-11T12:00:00Z' }] })
  panel.select('A')
  assert.ok(panel.button('Reenviar revisión a GC'))
  assert.equal(panel.button('Enviar a Revisión GC'), undefined)
  assert.equal(panel.nodes().some(node => node.props['data-investigation-return']), false)
  const empty = fixture()
  empty.select('A')
  assert.equal(empty.nodes().some(node => node.props['data-investigation-return']), false)
})

test('un mensaje de devolución muy largo abre el modal de ver más', () => {
  const panel = fixture({ actividad: [{ id: 'return', queja_id: 'A', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: ' + 'x'.repeat(300), created_at: '2026-11-11T19:00:00Z' }] })
  panel.select('A', { estado: 'Pendiente de Revisión GC' })
  const list = panel.nodes().find(node => node.props['data-investigation-return'])
  assert.ok(list)
  assert.ok(panel.button('Ver más'))
  panel.button('Ver más').props.onClick(); panel.render()
  const modal = panel.nodes().find(node => node.type === 'Modal' && node.props.title === 'Devolución de Calidad')
  assert.ok(modal)
  assert.equal(modal.props.open, true)
})

test('la propuesta captura revisión al editar y conserva borrador y formato ante conflicto', async () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('**Conclusión sintética**', 'markdown'); panel.render()
  panel.select('A', { revision: 99 })
  await panel.button('Enviar a Revisión GC').props.onClick(); panel.render()
  assert.equal(panel.calls.length, 1)
  assert.equal(panel.calls[0][0].revision, 7)
  assert.equal(panel.calls[0][1], 'Pendiente de Revisión GC')
  assert.equal(panel.calls[0][2].resolucionFormato, 'markdown')
  assert.equal(panel.editor().props.value, '**Conclusión sintética**')
})

test('una reasignación retira el editor y deja el caso de solo lectura', () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('Conclusión', 'plain'); panel.render()
  panel.select('A', { responsable_id: 'other' })
  assert.equal(panel.editor(), undefined)
  assert.equal(panel.button('Enviar a Revisión GC'), undefined)
  panel.openAnalysis()
  assert.equal(panel.button('Preparar resolución'), undefined)
  assert.equal(panel.calls.length, 0)
})

test('propuesta en revisión y estados finales conservan lectura y no permiten enviar ni aprobar', () => {
  for (const estado of ['Pendiente de Revisión GC', 'Resuelto', 'Finalizado', 'No Procede']) {
    const panel = fixture()
    panel.select('A', { estado, resolucion: 'Trabajo registrado' })
    assert.equal(panel.editor(), undefined)
    assert.equal(panel.button('Enviar a Revisión GC'), undefined)
    assert.equal(panel.button('Confirmar resolución'), undefined)
    assert.ok(panel.nodes().some(node => node.type === 'Content' && node.props.value === 'Trabajo registrado'))
    panel.openAnalysis()
    assert.equal(panel.button('Preparar resolución'), undefined)
  }
})

test('coincidir con el responsable no habilita edición para roles ajenos al workflow', () => {
  for (const rol of ['direccion', 'auditor', 'lector']) {
    const panel = fixture({ rol })
    panel.select('A')
    assert.equal(panel.editor(), undefined)
    assert.equal(panel.button('Enviar a Revisión GC'), undefined)
    assert.equal(panel.button('Análisis IA'), undefined)
    assert.equal(panel.calls.length, 0)
  }
})

test('asistencia secundaria conserva el único lienzo y su borrador durante la consulta', () => {
  const panel = fixture()
  panel.select('A')
  const assistance = () => panel.nodes().find(node => node.props['data-resolution-assistance'] !== undefined)
  assert.equal(assistance().props.hidden, true)
  panel.button('Asistencia para la resolución').props.onClick(); panel.render()
  panel.editor().props.onChange('Conclusión en curso', 'plain'); panel.render()
  panel.openAnalysis()
  panel.analysisModal().props.onClose(); panel.render()
  assert.equal(assistance().props.hidden, false)
  assert.equal(panel.editor().props.value, 'Conclusión en curso')
  panel.button('Asistencia para la resolución').props.onClick(); panel.render()
  assert.equal(assistance().props.hidden, true)
  assert.equal(panel.nodes().filter(node => node.type === 'Editor').length, 1)
})

test('borrador bloquea navegación; cambiar de visita retira borrador y lateral anteriores', () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('Borrador', 'plain'); panel.render()
  assert.equal(panel.button('Queja siguiente').props.disabled, true)
  panel.openAnalysis()
  panel.select('B')
  assert.equal(panel.analysisModal().props.open, false)
  assert.equal(panel.editor().props.value, '')
})

test('Adjuntar va junto a Guardar y lo subido se lista bajo el lienzo, sin otra consulta', () => {
  const panel = fixture()
  panel.select('A')
  const input = panel.nodes().find(node => node.props['aria-label'] === 'Adjuntar evidencia de investigación')
  assert.equal(input.props.disabled, false)
  const file = new File(['evidencia sintética'], 'Evidencia.pdf', { type: 'application/pdf' })
  const event = { target: { files: [file], value: 'seleccionado' } }
  input.props.onChange(event)
  assert.equal(event.target.value, '')
  assert.deepEqual(panel.uploads, [file])
  const all = panel.nodes()
  const attach = panel.button('Adjuntar')
  const save = panel.button('Guardar')
  assert.ok(all.indexOf(attach) > -1 && all.indexOf(attach) < all.indexOf(save))
  assert.equal(panel.editor().props.toolbarActions, undefined)
  const lists = all.filter(node => node.type === 'Attachments')
  assert.equal(lists.length, 1)
  assert.ok(all.indexOf(panel.editor()) < all.indexOf(lists[0]))
  assert.equal(lists[0].props.puedeEliminar(lists[0].props.adjuntos[0]), false)
  assert.equal(lists[0].props.puedeEliminar(lists[0].props.adjuntos[1]), true)
  panel.openAnalysis()
  const shared = panel.nodes().find(node => node.type?.name === 'QuejaAnalisisPanel').props.adjuntos
  assert.deepEqual(lists[0].props.adjuntos, shared)
  assert.ok(panel.nodes().filter(node => node.type === 'Attachments').every(node => node.props.layout === 'cards'))
})

test('una evidencia pendiente bloquea envío mientras permite consultar y cerrar Análisis', async () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('Conclusión documentada', 'plain'); panel.render()
  panel.uploading(true)
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, true)
  panel.openAnalysis()
  panel.analysisModal().props.onClose(); panel.render()
  assert.equal(panel.analysisModal().props.open, false)
  await panel.button('Enviar a Revisión GC').props.onClick()
  assert.equal(panel.calls.length, 0)
  panel.uploading(false)
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, false)
})

test('un envío confirmado entrega una sola transición a GC y el documento queda de lectura', async () => {
  const panel = fixture({ workflowError: false })
  panel.select('A')
  panel.editor().props.onChange('Conclusión documentada', 'plain'); panel.render()
  await panel.button('Enviar a Revisión GC').props.onClick(); panel.render()
  assert.equal(panel.calls.length, 1)
  assert.equal(panel.updates[0].estado, 'Pendiente de Revisión GC')
  panel.select('A', panel.updates[0])
  assert.equal(panel.editor(), undefined)
  assert.equal(panel.button('Enviar a Revisión GC'), undefined)
})

test('Guardar persiste sin enviar, deja el documento en lectura y vuelve a cargar el mismo texto/formato al reabrir', async () => {
  const panel = fixture()
  panel.select('A')
  assert.equal(panel.button('Guardar').props.disabled, true)
  assert.equal(panel.button('Guardar').props.variant, 'secondary')
  panel.editor().props.onChange('**Borrador guardado**', 'markdown'); panel.render()
  assert.equal(panel.button('Guardar').props.variant, 'primary')
  await panel.button('Guardar').props.onClick(); panel.render()
  assert.equal(panel.saves.length, 1)
  assert.equal(panel.saves[0][0].revision, 7)
  assert.equal(panel.saves[0][1], 0)
  assert.equal(panel.calls.length, 0)
  assert.equal(panel.updates.length, 0)
  assert.equal(panel.button('Guardar'), undefined)
  assert.equal(panel.editor().props.readOnly, true)
  assert.ok(panel.button('Editar').props.title.startsWith('Guardado el '))
  assert.equal(panel.button('Queja siguiente').props.disabled, false)
  panel.button('Editar').props.onClick(); panel.render()
  assert.equal(panel.editor().props.readOnly, false)
  assert.equal(panel.button('Guardar').props.disabled, true)
  assert.equal(panel.button('Guardar').props.variant, 'secondary')
  panel.select(null); panel.select('A')
  assert.equal(panel.editor().props.value, '**Borrador guardado**')
  assert.equal(panel.editor().props.format, 'markdown')
  assert.equal(panel.editor().props.readOnly, true)
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, false)
})

test('un refetch no sobrescribe el texto ni la versión capturada; conflicto conserva cambios', async () => {
  const remote = { queja_id:'A',version:3,contenido:'Borrador anterior',formato:'plain',updated_at:'2026-11-12T03:00:00Z' }
  const panel = fixture({ initialDraft: remote })
  panel.select('A')
  assert.equal(panel.editor().props.readOnly, true)
  panel.button('Editar').props.onClick(); panel.render()
  panel.editor().props.onChange('Mi edición nueva', 'plain'); panel.render()
  panel.remoteDraft('A', { ...remote, version:4, contenido:'Otra computadora' })
  assert.equal(panel.editor().props.value, 'Mi edición nueva')
  await panel.button('Guardar').props.onClick(); panel.render()
  assert.equal(panel.saves[0][1], 3)
  assert.equal(panel.errors.length, 1)
  assert.equal(panel.editor().props.value, 'Mi edición nueva')
  assert.equal(panel.button('Guardar').props.disabled, false)
  assert.equal(panel.calls.length, 0)
})

test('un fallo inicial de lectura bloquea guardar/enviar hasta conocer el borrador remoto', () => {
  const panel = fixture()
  panel.draftError(true); panel.select('A')
  assert.equal(panel.editor().props.disabled, true)
  assert.equal(panel.button('Guardar').props.disabled, true)
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, true)
  assert.ok(panel.button('Reintentar borrador'))
  panel.draftError(false)
  assert.equal(panel.editor().props.disabled, false)
})

test('guardar y enviar comparten exclusión; una respuesta tardía no modifica otra visita', async () => {
  let finish
  const panel = fixture({ saveWait: new Promise(resolve => { finish = resolve }) })
  panel.select('A')
  panel.editor().props.onChange('Trabajo de A', 'plain'); panel.render()
  const pending = panel.button('Guardar').props.onClick()
  await panel.button('Enviar a Revisión GC').props.onClick()
  assert.equal(panel.calls.length, 0)
  panel.select('B')
  panel.editor().props.onChange('Trabajo nuevo de B', 'plain'); panel.render()
  finish(); await pending; panel.render()
  assert.equal(panel.editor().props.value, 'Trabajo nuevo de B')
  panel.select('A')
  assert.equal(panel.editor().props.value, 'Trabajo de A')
})

test('la tarjeta de notas abre solo el panel, conserva ambos borradores y excluye la devolución del contador', () => {
  const panel = fixture({ actividad: [
    { id: 'note', tipo: 'nota', descripcion: 'Hallazgo conservado.', created_at: '2026-11-11T18:00:00Z' },
    { id: 'return', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: Ampliar evidencia.', created_at: '2026-11-11T19:00:00Z' },
  ] })
  panel.select('A')
  assert.equal(panel.nodes().some(node => node.type === 'textarea' && node.props['aria-label'] === 'Nueva nota de investigación'), false)
  const card = panel.nodes().find(node => node.type?.name === 'QuejaNotasCard')
  assert.deepEqual(card.props.notas.map(note => note.id), ['note'])
  panel.editor().props.onChange('Redacción en curso', 'plain'); panel.render()
  const editorId = panel.editor().props.id
  panel.openNotes()
  assert.equal(panel.notesModal().props.variant, 'dialog')
  const input = () => panel.nodes().find(node => node.type === 'textarea' && node.props['aria-label'] === 'Nueva nota de investigación')
  input().props.onChange({ target: { value: 'Nota aún sin enviar' } }); panel.render()
  panel.notesModal().props.onClose(); panel.render()
  assert.equal(panel.editor().props.id, editorId)
  assert.equal(panel.editor().props.value, 'Redacción en curso')
  panel.openNotes()
  assert.equal(input().props.value, 'Nota aún sin enviar')
  panel.select('B')
  assert.equal(panel.notesModal().props.open, false)
  panel.openNotes()
  assert.equal(input().props.value, '')
})

test('cerrar desde el workspace retira solo el panel de notas y no pierde la resolución', () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('Texto conservado', 'plain'); panel.render()
  panel.openNotes()
  panel.modal().props.onClose(); panel.render()
  assert.equal(panel.notesModal().props.open, false)
  assert.equal(panel.closed(), 0)
  assert.equal(panel.editor().props.value, 'Texto conservado')
  assert.equal(panel.nodes().filter(node => node.type === 'Button' && node.props.children?.at?.(-1) === 'Enviar a Revisión GC').length, 1)
})

test('la lectura de notas y archivos no concede escritura a un responsable ajeno', () => {
  const panel = fixture({ rol: 'lector' })
  panel.select('A', { resolucion: 'Documento registrado' })
  panel.openNotes()
  assert.equal(panel.button('Agregar nota'), undefined)
  panel.notesModal().props.onClose(); panel.render()
  const list = panel.nodes().find(node => node.type === 'Attachments')
  assert.ok(list.props.adjuntos.every(file => !list.props.puedeEliminar(file)))
  assert.equal(panel.button('Adjuntar'), undefined)
})

test('las notas propias se editan o eliminan desde el menú; las ajenas y la devolución no', async () => {
  const panel = fixture({ actividad: [
    { id: 'mine', queja_id: 'A', usuario_id: 'owner', tipo: 'nota', descripcion: 'Hallazgo editable.', created_at: '2026-11-11T18:00:00Z' },
    { id: 'other', queja_id: 'A', usuario_id: 'other', tipo: 'nota', descripcion: 'Nota ajena.', created_at: '2026-11-11T18:30:00Z' },
    { id: 'return', queja_id: 'A', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: Ampliar evidencia.', created_at: '2026-11-11T19:00:00Z' },
  ] })
  panel.select('A')
  panel.openNotes()
  const menus = () => panel.nodes().filter(node => node.props['aria-label'] === 'Opciones de la nota')
  assert.equal(menus().length, 1)
  assert.equal(panel.nodes().filter(node => node.props['data-investigation-note']).length, 2)
  menus()[0].props.onClick(); panel.render()
  assert.ok(panel.button('Editar')); assert.ok(panel.button('Eliminar'))
  panel.button('Editar').props.onClick(); panel.render()
  const edit = panel.nodes().find(node => node.type === 'textarea' && node.props['aria-label'] === 'Editar nota de investigación')
  assert.equal(edit.props.value, 'Hallazgo editable.')
  edit.props.onChange({ target: { value: 'Hallazgo corregido.' } }); panel.render()
  await panel.button('Guardar cambios').props.onClick(); panel.render()
  assert.equal(panel.noteUpdates.length, 1)
  assert.equal(panel.noteUpdates[0][0].id, 'mine')
  assert.equal(panel.noteUpdates[0][1], 'Hallazgo corregido.')
  panel.nodes().find(node => node.props['aria-label'] === 'Opciones de la nota').props.onClick(); panel.render()
  panel.button('Eliminar').props.onClick(); panel.render()
  assert.match(JSON.stringify(panel.nodes().find(node => node.props.role === 'menu').props.children), /¿Eliminar esta nota\?/)
  await panel.button('Eliminar').props.onClick(); panel.render()
  assert.equal(panel.noteDeletes.length, 1)
  assert.equal(panel.noteDeletes[0].id, 'mine')
})

test('al guardar, los archivos siguen bajo el documento y Guardar se convierte en Editar', async () => {
  const panel = fixture()
  panel.select('A')
  assert.ok(panel.nodes().some(node => node.props['data-resolution-attachments']))
  assert.ok(panel.nodes().find(node => node.type === 'Attachments').props.adjuntos.length > 0)
  panel.editor().props.onChange('Trabajo guardado', 'plain'); panel.render()
  await panel.button('Guardar').props.onClick(); panel.render()
  assert.ok(panel.nodes().some(node => node.props['data-resolution-attachments']))
  const list = panel.nodes().find(node => node.type === 'Attachments')
  assert.equal(list.props.layout, 'cards')
  assert.deepEqual(list.props.adjuntos.map(file => file.id), ['client-file', 'file'])
  assert.equal(panel.button('Guardar'), undefined)
  assert.ok(panel.button('Editar'))
})
