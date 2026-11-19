import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'
import { readFileSync } from 'node:fs'

// Los eventos y estados son del componente real; red, sesión y editor pesado son dobles locales.
function fixture({ rol = 'colaborador', actividad = [], workflowError = true, initialDraft = null, saveWait, autoExpand = true,
  asignacion: assignment = null, devoluciones: returns = [], adjuntos: attachments = [
    { id: 'client-file', usuario_id: null, nombre: 'Solicitud.pdf' }, { id: 'file', usuario_id: 'owner', nombre: 'Informe.pdf' },
  ] } = {}) {
  const slots = [], calls = [], locks = [], errors = [], uploads = [], updates = [], saves = [], noteUpdates = [], noteDeletes = [], assistCalls = []
  const drafts = new Map(initialDraft ? [[initialDraft.queja_id, initialDraft]] : [])
  let draftError = false, generation = 0, guardId, active = false
  const lanes = new Set()
  let cursor = 0, changed = false, tree, queja = null, closed = 0
  let uploading = false
  const user = { id: 'owner', rol, nombre: 'Colaborador de prueba' }
  const react = {
    useEffect() {}, useLayoutEffect() {}, useCallback: value => value,
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i] },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; changed = true } }] },
  }
  const { default: Panel } = loadModule('app/mis-quejas/components/QuejaColaboradorPanel.tsx', {
    react,
    '@tanstack/react-query': { useQuery: () => ({}), useQueryClient: () => ({ setQueryData: (key, value) => drafts.set(key.at(-1), value), invalidateQueries() {} }) },
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
    '@/lib/queries/useQuejaHistorial': { useQuejaHistorial: () => ({ data: [], isPending: false, isError: false }) },
    '@/lib/queries/useQuejaDevoluciones': { useQuejaDevoluciones: () => ({ data: returns }) },
    '@/lib/queries/useQuejaInvestigationAssignment': { useQuejaInvestigationAssignment: () => ({ data: assignment }) },
    '@/lib/queries/useQuejas': { useQuejaAdjuntos: () => ({ data: attachments }) },
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
    '@/hooks/useQuejaAttachmentActions': { useQuejaAttachmentActions: () => ({ previewAdjunto: null, confirmarEliminacion: null, subiendoAdjunto: uploading, eliminandoAdjunto: null, handleSubirAdjuntos: async files => { uploads.push(...files) }, setConfirmarEliminacion() {} }) },
    '@/app/mis-quejas/components/useQuejaAssistant': { useQuejaAssistant: () => ({ aiAutoLoading: false, chatLoading: false, aiResult: '', chat: [], chatInput: '', setAiResult() {}, setChatInput() {}, handleAnalisisAuto() { assistCalls.push('auto') }, handleEnviarIA() {}, setModoEdicion() {} }) },
  }, { window: { innerHeight: 900, getSelection: () => null, matchMedia: () => ({ matches: true }), addEventListener() {}, removeEventListener() {} }, requestAnimationFrame() {} })
  const visit = value => {
    if (Array.isArray(value)) return value.flatMap(visit)
    if (!value?.props) return []
    if (['QuejaInvestigacionResumen', 'QuejaAnalisisPanel', 'QuejaNotasCard', 'QuejaNotasPanel', 'QuejaAdjuntosCard', 'QuejaAdjuntosInvestigacion', 'CaseWorkspaceNavigation', 'MisQuejasBreadcrumb', 'CaseTriageNextStep', 'QuejaHistorial', 'Tabs'].includes(value.type?.name)) return [value, ...visit(value.type(value.props))]
    if (value.type === 'Modal' && !value.props.open) return [value]
    return [value, ...visit(value.props.children), ...visit(value.props.toolbarActions), ...visit(value.props.headerActions), ...visit(value.props.footer), ...visit(value.props.compact), ...visit(value.props.cycle), ...visit(value.props.action), ...visit(value.props.request), ...visit(value.props.requestFooter), ...visit(value.props.headerCenter), ...visit(value.props.compactContent), ...visit(value.props.primaryAction)]
  }
  const nodes = () => visit(tree)
  const text = value => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
  function render() { do { changed = false; cursor = 0; tree = Panel({ queja, onClose: () => closed++, onUpdated: updated => updates.push(updated), onNavigationLockChange: lock => locks.push(lock), onPrevious() {}, onNext() {} }) } while (changed) }
  const button = label => nodes().find(node => (node.type === 'Button' && (node.props['aria-label'] === label || text(node).trim() === label)) || (node.type === 'button' && text(node).includes(label)))
  return {
    calls, errors, nodes, render, uploads, updates, saves, noteUpdates, noteDeletes, assistCalls,
    remoteDraft(id, value) { drafts.set(id, value); render() },
    draftError(value) { draftError = value; render() },
    select(id, extra = {}) {
      const nuevaVisita = id && id !== queja?.id
      queja = id ? { id, folio: '2026-001', cliente_nombre: 'Persona sintética', fecha: '2026-10-15', categoria: 'Queja', estado: 'En Investigación', responsable_id: 'owner', revision: 7, ...extra } : null
      render()
      if (nuevaVisita && autoExpand && button('Ampliar expediente')) { button('Ampliar expediente').props.onClick(); render() }
    },
    stage(id) { nodes().find(node => node.props['data-case-stage'] === id).props.onClick(); render() },
    activeStage: () => nodes().find(node => node.props['data-case-stage'] && node.props['aria-pressed'])?.props['data-case-stage'],
    openAnalysis() { this.stage('analisis') },
    openNotes() { nodes().find(node => node.props['data-investigation-notes-card']).props.onClick(); render() },
    modal: () => nodes().find(node => node.type === 'Modal' && node.props.variant === 'workspace'),
    analysisModal: () => nodes().find(node => node.type === 'Modal' && node.props.title.startsWith('Análisis')),
    notesModal: () => nodes().find(node => node.type === 'Modal' && node.props.title === 'Historial y notas'),
    button,
    uploading(value) { uploading = value; render() },
    editor: () => nodes().find(node => node.type === 'Editor' && !nodes().some(parent => parent.props.hidden && visit(parent.props.children).includes(node))),
    closed: () => closed,
  }
}

test('Mis Quejas comparte workspace ampliable; cerrar y volver a abrir restablece lateral', () => {
  const panel = fixture({ autoExpand: false })
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
  assert.equal(workspace.props.cyclePlacement, 'header')
  assert.equal(workspace.props.presentation, 'reference')
  assert.equal(workspace.props.readingLayout, true)
  assert.equal(workspace.props.qualityTwoColumn, true)
  assert.equal(workspace.props.documentStyle, 'sheet')
  assert.equal(panel.modal().props.headerTone, 'quality')
  assert.ok(panel.nodes().some(node => node.props['data-mis-quejas-reading-column']))
  assert.ok(panel.nodes().some(node => node.props['data-mis-quejas-chevrons']))
  assert.equal(workspace.props.request, undefined, 'sin duplicar los datos del solicitante en el lateral')
  assert.equal(panel.modal().props.headerSubtitle.type.name, 'QuejaClienteDropdown')
  assert.equal(workspace.props.requestFooter.type, 'div')
  assert.equal(workspace.props.requestFooter.props.children[0].type, 'button')
  assert.equal(workspace.props.requestFooter.props.children[0].props['data-investigation-files-card'], true)
  assert.equal(workspace.props.requestFooter.props.children[1].props['data-investigation-notes-card'], true)
  assert.ok(panel.modal().props.headerCenter)
  assert.equal(workspace.props.cycle.type.name, 'MisQuejasBreadcrumb')
  assert.equal(panel.editor().props.label, 'Resolución')
  assert.equal(panel.nodes().find(node => node.props['data-resolution-header']), undefined)
  const footer = panel.nodes().find(node => node.props['data-resolution-footer'])
  assert.ok(footer)
  assert.match(footer.props.className, /sticky bottom-0/)
  assert.ok(panel.button('Asistencia para la resolución'))
  assert.ok(panel.button('Expandir editor verticalmente'))
  assert.ok(panel.nodes().find(node => node.props['data-resolution-shell']))
  assert.equal(panel.editor().props.showFormattingHint, false)
  assert.match(panel.nodes().find(node => node.props['data-resolution-inline']).props.className, /overflow-hidden/)
  assert.equal(panel.editor().props.layout, 'fill')
  assert.equal(panel.editor().props.minHeight, 540)
  assert.equal(panel.editor().props.variant, 'document')
  assert.equal(panel.editor().props.maxLength, 10000)
  assert.equal(panel.editor().props.format, 'plain')
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, true)
  assert.equal(panel.nodes().filter(node => node.type === 'Editor').length, 1)
  assert.equal(panel.nodes().some(node => node.props.role === 'tab' || node.type === 'Modal' && node.props.open && node.props.variant === 'document'), false)
})

test('la resolución recupera el ancho original, con entorno gris y barra de formato diferenciada', () => {
  const panel = fixture()
  panel.select('A')
  const reading = panel.nodes().find(node => node.props['data-mis-quejas-reading-column'])
  const shell = panel.nodes().find(node => node.props['data-resolution-shell'])
  const editor = panel.nodes().find(node => node.props['data-resolution-inline'])
  assert.ok(reading.props.className.includes('max-w-[960px]'), 'restaurar ancho original')
  assert.ok(reading.props.className.includes('mx-auto'), 'centrar el editor')
  assert.ok(reading.props.className.includes('bg-[#F3F6FB]'), 'igualar fondo de Acciones del responsable')
  assert.ok(reading.props.className.includes('sm:pt-4'), 'editor ligeramente más arriba')
  assert.ok(shell.props.className.includes('min-w-0'))
  assert.ok(!shell.props.className.includes('border'), 'sin bordes de contenedor externos')
  assert.ok(editor.props.className.includes('border-qms-border'), 'único borde del editor')
  assert.ok(editor.props.className.includes('bg-white'))
  assert.ok(editor.props.className.includes('shadow-sm'))
  assert.ok(panel.editor().props.className.includes('bg-[#EFF1F4]'), 'barra de formato gris')
  assert.equal(panel.nodes().filter(node => node.type === 'Editor').length, 1)
  const css = readFileSync('app/styles/components.css', 'utf8')
  assert.ok(css.includes('[data-case-document]:has([data-mis-quejas-reading-column]) {\n  background: #F3F6FB;'))
  assert.ok(css.includes('background: #EFF1F4;'))
  const source = readFileSync('app/mis-quejas/components/QuejaColaboradorPanel.tsx', 'utf8')
  assert.ok(source.includes('border-b border-[#D3DAE4] bg-[#EFF1F4]'), 'barra de borrador guardado')
  assert.ok(css.includes('padding: 20px 24px 28px;'))
  assert.ok(css.includes('overflow-y: auto;'))
  assert.ok(panel.button('Guardar'))
  assert.ok(panel.button('Expandir editor verticalmente'))
})

test('el editor abre sin saltar el scroll exterior y no dibuja líneas artificiales', () => {
  const source = readFileSync('app/mis-quejas/components/QuejaColaboradorPanel.tsx', 'utf8')
  const css = readFileSync('app/styles/components.css', 'utf8')
  assert.doesNotMatch(source, /scrollIntoView\(\{ block: 'start' \}\)/)
  assert.match(source, /scrollports\?\.forEach\(scrollport => \{ scrollport\.scrollTop = 0 \}\)/)
  assert.match(source, /focus\(\{ preventScroll: true \}\)/)
  assert.doesNotMatch(css, /\[data-case-document\]:has\(\[data-resolution-shell\]\)\s*\{\s*position:\s*sticky/)
  assert.doesNotMatch(css, /\.mis-quejas-resolution-editor \[data-rich-text-viewport\]::before/)
  const actions = source.slice(source.indexOf('data-resolution-toolbar-actions'), source.indexOf('className="mis-quejas-resolution-editor"'))
  assert.match(actions, /data-resolution-expand-separator/)
  assert.match(actions, /h-11 w-11/)
  assert.match(actions, /<Maximize aria-hidden="true" className="size-5"/)
  assert.match(actions, /<Minimize aria-hidden="true" className="size-5"/)
  assert.match(source, /h-\[clamp\(420px,calc\(100dvh-95px\),820px\)\]/)
})

test('expandir conserva ancho y pie sin remontar el editor; contraer restaura el alto normal', () => {
  const panel = fixture()
  panel.select('A')
  const editorId = panel.editor().props.id
  const original = panel.nodes().find(node => node.props['data-resolution-inline'])
  original.props.ref.current = {
    getBoundingClientRect: () => ({ top: 92, bottom: 780, left: 365, width: 860, height: 688 }),
    closest: () => ({ getBoundingClientRect: () => ({ top: 0, bottom: 900 }) }),
  }
  panel.button('Expandir editor verticalmente').props.onClick(); panel.render()
  const expanded = panel.nodes().find(node => node.props['data-resolution-inline'])
  assert.equal(expanded.props['data-resolution-expanded'], 'true')
  assert.equal(expanded.props.style.left, 365)
  assert.equal(expanded.props.style.width, 860)
  assert.equal(expanded.props.style.top, 8)
  assert.equal(expanded.props.style.height, 772)
  assert.match(expanded.props.className, /fixed/)
  assert.equal(panel.editor().props.id, editorId)
  assert.ok(panel.button('Contraer editor'))
  assert.ok(panel.nodes().find(node => node.props['data-resolution-footer']))
  panel.button('Contraer editor').props.onClick(); panel.render()
  assert.equal(panel.nodes().find(node => node.props['data-resolution-inline']).props['data-resolution-expanded'], undefined)
  assert.equal(panel.editor().props.id, editorId)
})

test('Guardar y Cancelar restauran altura normal; Editar no expande hasta solicitarlo', async () => {
  const panel = fixture()
  panel.select('A')
  assert.equal(panel.button('Guardar').props.variant, 'primary')
  assert.match(panel.button('Guardar').props.className, /disabled:opacity-100!/)
  panel.editor().props.onChange('Borrador', 'plain'); panel.render()
  const card = panel.nodes().find(node => node.props['data-resolution-inline'])
  card.props.ref.current = {
    getBoundingClientRect: () => ({ top: 92, bottom: 780, left: 365, width: 860, height: 688 }),
    closest: () => ({ getBoundingClientRect: () => ({ top: 0, bottom: 900 }) }),
  }
  panel.button('Expandir editor verticalmente').props.onClick(); panel.render()
  assert.ok(panel.button('Contraer editor'))
  await panel.button('Guardar').props.onClick(); panel.render()
  assert.equal(panel.button('Contraer editor'), undefined)
  assert.equal(panel.nodes().find(node => node.props['data-resolution-inline']).props['data-resolution-expanded'], undefined)
  const top = panel.nodes().find(node => node.props['data-resolution-saved-toolbar'])
  assert.ok(top)
  assert.ok(panel.button('Editar'))
  assert.equal(panel.nodes().find(node => node.props['data-resolution-footer']) !== undefined, true)
  panel.button('Editar').props.onClick(); panel.render()
  assert.ok(panel.button('Expandir editor verticalmente'))
  assert.equal(panel.nodes().find(node => node.props['data-resolution-inline']).props['data-resolution-expanded'], undefined)
  panel.button('Expandir editor verticalmente').props.onClick(); panel.render()
  assert.ok(panel.button('Contraer editor'))
  panel.button('Cancelar').props.onClick(); panel.render()
  assert.equal(panel.nodes().find(node => node.props['data-resolution-inline']).props['data-resolution-expanded'], undefined)
})

test('el breadcrumb abre Análisis de solo lectura y conserva el borrador al regresar', () => {
  const panel = fixture()
  panel.select('A', { justificacion_procede: 'Observación de Calidad registrada.' })
  const editorId = panel.editor().props.id
  panel.editor().props.onChange('Borrador en curso', 'plain'); panel.render()
  panel.openAnalysis()
  assert.equal(panel.activeStage(), 'analisis')
  assert.equal(panel.modal().props.expanded, true)
  assert.equal(panel.analysisModal(), undefined)
  assert.ok(panel.nodes().some(node => node.props['data-mis-quejas-analysis']))
  assert.ok(panel.nodes().some(node => node.props['data-client-description']))
  assert.equal(panel.nodes().find(node => node.type === 'Badge' && node.props.children === 'Procede').props.variant, 'blue')
  assert.equal(panel.editor(), undefined)
  assert.equal(panel.button('Enviar a Revisión GC'), undefined)
  panel.button('Ir a Resolución').props.onClick(); panel.render()
  assert.equal(panel.activeStage(), 'resolucion')
  assert.equal(panel.editor().props.id, editorId)
  assert.equal(panel.editor().props.value, 'Borrador en curso')
})

test('el panel lateral conserva la etapa y amplía el editor desde Resolución', () => {
  const panel = fixture({ autoExpand: false })
  panel.select('A')
  panel.openAnalysis()
  assert.equal(panel.modal().props.expanded, false)
  assert.equal(panel.activeStage(), 'analisis')
  panel.button('Ir a Resolución').props.onClick(); panel.render()
  assert.equal(panel.activeStage(), 'resolucion')
  panel.button('Abrir editor para redactar').props.onClick(); panel.render()
  assert.equal(panel.modal().props.expanded, true)
  assert.equal(panel.editor().props.value, '')
})

test('la devolución activa muestra el aviso y cambia el botón a Reenviar a Revisión GC', () => {
  const panel = fixture({ actividad: [{ id: 'return', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: Falta documentar evidencia.', created_at: '2026-11-11T12:00:00Z' }] })
  panel.select('A')
  assert.ok(panel.button('Reenviar a Revisión GC'))
  assert.equal(panel.button('Enviar a Revisión GC'), undefined)
  assert.ok(panel.nodes().some(node => node.props['data-investigation-return']))
  assert.equal(panel.button('Ver más'), undefined)
  const empty = fixture()
  empty.select('A')
  assert.ok(empty.button('Enviar a Revisión GC'))
  assert.equal(empty.nodes().some(node => node.props['data-investigation-return']), false)
})

test('el spinner de reenvío sustituye al icono sin agregar ancho o una segunda línea', async () => {
  const panel = fixture({ actividad: [{
    id: 'return', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: Completar evidencia.',
    created_at: '2026-11-11T12:00:00Z',
  }] })
  panel.select('A')
  panel.editor().props.onChange('Propuesta corregida', 'plain'); panel.render()
  const initial = panel.button('Reenviar a Revisión GC')
  assert.equal(initial.props.loading, false)
  assert.ok(initial.props.children[0])
  const pending = initial.props.onClick()
  panel.render()
  const busy = panel.button('Reenviar a Revisión GC')
  assert.equal(busy.props.loading, true)
  assert.equal(busy.props.disabled, true)
  assert.equal(busy.props.children[0], null, 'el icono se retira mientras el spinner ocupa el mismo lugar')
  assert.equal(busy.props.className, initial.props.className)
  await pending; panel.render()
  assert.equal(panel.button('Reenviar a Revisión GC').props.loading, false)
})

test('un mensaje de devolución largo se resume y abre el modal con el texto íntegro', () => {
  const motivo = 'x'.repeat(300)
  const panel = fixture({ actividad: [{ id: 'return', queja_id: 'A', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: ' + motivo, created_at: '2026-11-11T19:00:00Z' }] })
  panel.select('A')
  const aviso = panel.nodes().find(node => node.props['data-investigation-return'])
  assert.ok(aviso)
  assert.ok(panel.button('Ver más'))
  panel.button('Ver más').props.onClick(); panel.render()
  const modal = panel.nodes().find(node => node.type === 'Modal' && node.props.title === 'Devolución de Calidad')
  assert.ok(modal)
  assert.equal(modal.props.open, true)
  const motivos = Array.from(modal.props.children.props.children, item => item.props.children[1].props.children)
  assert.deepEqual(motivos, [motivo])
})

test('dos devoluciones cortas también habilitan Ver más y se muestran de nueva a antigua', () => {
  const panel = fixture({ actividad: [
    { id: 'r2', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: Segunda observación.', created_at: '2026-11-12T19:00:00Z' },
    { id: 'n', tipo: 'nota', descripcion: 'Nota del responsable', created_at: '2026-11-11T20:00:00Z' },
    { id: 'r1', tipo: 'nota', descripcion: 'Devuelta a investigación. Motivo: Primera observación.', created_at: '2026-11-11T19:00:00Z' },
  ] })
  panel.select('A')
  assert.ok(panel.button('Reenviar a Revisión GC'))
  assert.ok(panel.button('Ver más'))
  panel.button('Ver más').props.onClick(); panel.render()
  const modal = panel.nodes().find(node => node.type === 'Modal' && node.props.title === 'Devolución de Calidad')
  const motivos = Array.from(modal.props.children.props.children, item => item.props.children[1].props.children)
  assert.deepEqual(motivos, ['Segunda observación.', 'Primera observación.'])
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
    if (estado !== 'No Procede') {
      assert.equal(panel.activeStage(), 'revision')
      panel.stage('resolucion')
    }
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
    assert.equal(panel.button('Asistencia para la resolución'), undefined)
    assert.equal(panel.calls.length, 0)
  }
})

test('un clic en Asistencia IA inicia análisis sin chat ni desplegables y conserva la resolución', () => {
  const panel = fixture()
  panel.select('A')
  const button = panel.button('Asistencia para la resolución')
  assert.ok(button)
  assert.equal(button.props['data-resolution-assist'], true)
  assert.equal(panel.nodes().find(node => node.props['data-resolution-assistance']), undefined)
  assert.equal(panel.nodes().some(node => node.type === 'details' || node.type === 'summary'), false)
  assert.equal(panel.button('Análisis IA'), undefined)
  button.props.onClick(); panel.render()
  assert.deepEqual(panel.assistCalls, ['auto'])
  panel.editor().props.onChange('Conclusión en curso', 'plain'); panel.render()
  panel.openAnalysis()
  panel.stage('resolucion')
  assert.equal(panel.editor().props.value, 'Conclusión en curso')
  assert.equal(panel.nodes().filter(node => node.type === 'Editor').length, 1)
})

test('borrador bloquea navegación; cambiar de visita retira borrador y lateral anteriores', () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('Borrador', 'plain'); panel.render()
  assert.equal(panel.button('Queja siguiente').props.disabled, true)
  panel.openAnalysis()
  panel.select('B')
  assert.equal(panel.activeStage(), 'resolucion')
  assert.equal(panel.editor().props.value, '')
})

test('Mis adjuntos excluye a Calidad, al cliente y al oficio aunque el autor sea el responsable', () => {
  const panel = fixture({
    asignacion: { oficio_adjunto_id: 'office', updated_at: '2026-11-01' },
    devoluciones: [{ adjuntoIds: ['return-file'], motivo: 'Completar', fecha: '2026-11-04' }],
    adjuntos: [
      { id: 'client-file', usuario_id: null, nombre: 'Solicitud.pdf' },
      { id: 'file', usuario_id: 'owner', created_at: '2026-11-02', nombre: 'Informe.pdf' },
      { id: 'office', usuario_id: 'owner', created_at: '2026-11-02', nombre: 'Oficio.pdf' },
      { id: 'return-file', usuario_id: 'owner', created_at: '2026-11-04', nombre: 'Devolución.pdf' },
      { id: 'quality', usuario_id: 'quality', created_at: '2026-11-03', nombre: 'Análisis de Calidad.pdf' },
      { id: 'earlier', usuario_id: 'owner', created_at: '2026-10-30', nombre: 'Evaluación.pdf' },
    ],
  })
  panel.select('A')
  assert.equal(panel.nodes().some(node => node.props['data-resolution-attachments']), false)
  assert.equal(panel.button('Adjuntar'), undefined)
  const card = panel.nodes().find(node => node.props['data-investigation-files-card'])
  assert.ok(card)
  assert.ok(panel.nodes().some(node => node.props['data-investigation-notes-card']))
  const openFiles = panel.nodes().find(node => node.type === 'button' && node.props['aria-label'] === 'Ver mis adjuntos')
  openFiles.props.onClick(); panel.render()
  const filesModal = panel.nodes().find(node => node.type === 'Modal' && node.props.title.startsWith('Mis adjuntos'))
  assert.equal(filesModal.props.fixedHeight, true)
  assert.ok(panel.nodes().some(node => node.props['data-attachment-list-scroll']))
  const list = panel.nodes().find(node => node.type === 'Attachments')
  assert.equal(list.props.layout, 'modal')
  assert.deepEqual(Array.from(list.props.adjuntos, file => file.id), ['file'])
  assert.equal(list.props.puedeEliminar(list.props.adjuntos[0]), true)
  assert.ok(panel.button('Agregar archivos'))
  panel.modal().props.onClose(); panel.render()
  assert.equal(panel.nodes().find(node => node.type === 'Modal' && node.props.title?.startsWith('Mis adjuntos')).props.open, false)
  panel.openAnalysis()
  const listas = panel.nodes().filter(node => node.type === 'Attachments')
  assert.deepEqual(Array.from(listas[0].props.adjuntos, file => file.id), ['client-file'])
  assert.deepEqual(Array.from(listas[1].props.adjuntos, file => file.id), ['office', 'return-file', 'quality', 'earlier'])
  assert.ok(listas.every(node => !node.props.puedeEliminar))
})

test('la tarjeta lateral solo abre el modal; arrastrar y adjuntar ocurre dentro del modal', async () => {
  const panel = fixture()
  panel.select('A')
  const card = panel.nodes().find(node => node.props['data-investigation-files-card'])
  assert.ok(card)
  assert.equal(card.props.onDrop, undefined)
  assert.equal(card.props.onDragOver, undefined)
  assert.equal(card.props.onFiles, undefined)
  assert.equal(panel.nodes().some(node => node.props['data-investigation-files-drop']), false)
  panel.nodes().find(node => node.props['aria-label'] === 'Ver mis adjuntos').props.onClick()
  panel.render()
  const dropZone = panel.nodes().find(node => node.props['data-investigation-files-drop'])
  assert.ok(dropZone)
  const one = new File(['primero'], 'Primero.pdf', { type: 'application/pdf' })
  const two = new File(['segundo'], 'Segundo.png', { type: 'image/png' })
  let prevented = 0, stopped = 0
  const target = { dataset: {} }
  dropZone.props.onDragOver({ currentTarget: target, dataTransfer: { types: ['Files'], dropEffect: 'none' }, preventDefault() { prevented++ } })
  assert.equal(target.dataset.dragging, 'true')
  dropZone.props.onDrop({ currentTarget: target, dataTransfer: { types: ['Files'], files: [one, two] }, preventDefault() { prevented++ }, stopPropagation() { stopped++ } })
  await new Promise(setImmediate)
  assert.deepEqual(panel.uploads, [one, two])
  assert.equal(target.dataset.dragging, undefined)
  assert.equal(prevented, 2)
  assert.equal(stopped, 1)
})

test('una evidencia pendiente bloquea envío mientras permite consultar y cerrar Análisis', async () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('Conclusión documentada', 'plain'); panel.render()
  panel.uploading(true)
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, true)
  panel.openAnalysis()
  panel.stage('resolucion')
  assert.equal(panel.activeStage(), 'resolucion')
  await panel.button('Enviar a Revisión GC').props.onClick()
  assert.equal(panel.calls.length, 0)
  panel.uploading(false)
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, false)
})

test('un único acceso lateral reúne historial y notas de investigación', () => {
  const panel = fixture()
  panel.select('A')
  assert.equal(panel.nodes().filter(node => node.props['data-investigation-notes-card']).length, 1)
  assert.equal(panel.nodes().some(node => node.type?.name === 'CaseSidebarShortcut'), false)
  panel.openNotes()
  assert.equal(panel.notesModal().props.open, true)
  assert.ok(panel.nodes().some(node => node.props.role === 'tab' && node.props.children === 'Historial'))
})

test('en revisión el historial es consultable sin agregar notas', () => {
  const panel = fixture()
  panel.select('A', { estado: 'Pendiente de Revisión GC' })
  panel.openNotes()
  assert.equal(panel.notesModal().props.open, true)
  assert.equal(panel.nodes().some(node => node.props['aria-label'] === 'Agregar nota'), false)
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
  assert.equal(panel.nodes().find(node => node.type?.name === 'QuejaCierreResumen').props.revisionResponsable.estado, 'Pendiente')
})

test('Guardar persiste sin enviar, deja el documento en lectura y vuelve a cargar el mismo texto/formato al reabrir', async () => {
  const panel = fixture()
  panel.select('A')
  assert.equal(panel.button('Guardar').props.disabled, true)
  assert.equal(panel.button('Guardar').props.variant, 'primary')
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
  assert.equal(panel.button('Guardar').props.variant, 'primary')
  panel.select(null); panel.select('A')
  assert.equal(panel.editor().props.value, '**Borrador guardado**')
  assert.equal(panel.editor().props.format, 'markdown')
  assert.equal(panel.editor().props.readOnly, true)
  assert.equal(panel.button('Enviar a Revisión GC').props.disabled, false)
})

test('Cancelar restaurará el último borrador sin grabar ni enviar y permitirá volver a editar', () => {
  const saved = { queja_id: 'A', version: 3, contenido: '**Versión guardada**', formato: 'markdown', updated_at: '2026-11-12T03:00:00Z' }
  const panel = fixture({ initialDraft: saved })
  panel.select('A')
  panel.button('Editar').props.onClick(); panel.render()
  assert.equal(panel.button('Cancelar').props.disabled, false)
  panel.editor().props.onChange('Cambio sin guardar', 'plain'); panel.render()
  assert.equal(panel.button('Queja siguiente').props.disabled, true)
  panel.button('Cancelar').props.onClick(); panel.render()
  assert.equal(panel.editor().props.value, '**Versión guardada**')
  assert.equal(panel.editor().props.format, 'markdown')
  assert.equal(panel.editor().props.readOnly, true)
  assert.equal(panel.button('Cancelar'), undefined)
  assert.equal(panel.button('Guardar'), undefined)
  assert.equal(panel.button('Queja siguiente').props.disabled, false)
  assert.equal(panel.saves.length, 0)
  assert.equal(panel.calls.length, 0)
  panel.button('Editar').props.onClick(); panel.render()
  assert.equal(panel.editor().props.readOnly, false)
  assert.equal(panel.button('Guardar').props.disabled, true)
})

test('Cancelar sin borrador inicial regresa a lectura sin simular que se guardó', () => {
  const panel = fixture()
  panel.select('A')
  panel.editor().props.onChange('Prueba descartada', 'plain'); panel.render()
  panel.button('Cancelar').props.onClick(); panel.render()
  assert.equal(panel.editor().props.value, '')
  assert.equal(panel.editor().props.readOnly, true)
  assert.equal(panel.button('Guardar'), undefined)
  assert.equal(panel.saves.length, 0)
  assert.ok(panel.button('Editar'))
})

test('notas y adjuntos comparten altura fija con lista de scroll y acciones ancladas', () => {
  const panel = fixture()
  panel.select('A')
  panel.openNotes()
  const notes = panel.notesModal()
  assert.equal(notes.props.size, 'lg')
  assert.equal(notes.props.fixedHeight, true)
  assert.ok(panel.nodes().find(node => node.props['data-investigation-notes-scroll']))
  assert.ok(panel.nodes().find(node => node.type === 'button' && node.props['aria-label'] === 'Agregar nota'))
  notes.props.onClose(); panel.render()
  const openFiles = panel.nodes().find(node => node.type === 'button' && node.props['aria-label'] === 'Ver mis adjuntos')
  openFiles.props.onClick(); panel.render()
  const files = panel.nodes().find(node => node.type === 'Modal' && node.props.title.startsWith('Mis adjuntos'))
  assert.equal(files.props.size, 'lg')
  assert.equal(files.props.fixedHeight, true)
  assert.ok(panel.nodes().find(node => node.props['data-attachment-list-scroll']))
  assert.ok(panel.nodes().find(node => node.props['data-investigation-files-drop']))
  assert.ok(panel.button('Agregar archivos'))
})

test('Mis notas conserva el botón + y elimina el nombre repetido de cada tarjeta', () => {
  const panel = fixture({ actividad: [
    { id: 'mine', queja_id: 'A', tipo: 'nota', usuario_id: 'owner', descripcion: 'Nota propia', created_at: '2026-11-11T18:00:00Z' },
    { id: 'other', queja_id: 'A', tipo: 'nota', usuario_id: 'other', descripcion: 'Nota ajena', created_at: '2026-11-11T18:05:00Z' },
  ] })
  panel.select('A'); panel.openNotes()
  const modal = panel.notesModal()
  assert.equal(modal.props.title, 'Historial y notas')
  assert.equal(modal.props.titleSuffix, '2026-001')
  assert.deepEqual(modal.props.currentUser, undefined)
  const add = panel.nodes().find(node => node.type === 'button' && node.props['aria-label'] === 'Agregar nota')
  assert.ok(add)
  assert.ok(add.props.className.includes('absolute right-3 bottom-3'))
  assert.equal(add.props.disabled, true)
  assert.equal(panel.nodes().filter(node => node.type === 'span' && node.props.title === 'Colaborador de prueba').length, 0)
  assert.equal(panel.nodes().filter(node => node.type === 'span' && node.props.title === 'Usuario del expediente').length, 0)
  assert.equal(panel.nodes().filter(node => node.props['aria-label'] === 'Opciones de la nota').length, 1)
  const input = panel.nodes().find(node => node.type === 'textarea' && node.props['aria-label'] === 'Nueva nota de investigación')
  input.props.onChange({ target: { value: 'Texto nuevo' } }); panel.render()
  const enabled = panel.nodes().find(node => node.type === 'button' && node.props['aria-label'] === 'Agregar nota')
  assert.equal(enabled.props.disabled, false)
})

test('adjuntos conserva la zona inferior incluso sin permiso de carga, pero impide agregar', () => {
  const panel = fixture({ rol: 'lector' })
  panel.select('A'); panel.nodes().find(node => node.type === 'button' && node.props['aria-label'] === 'Ver mis adjuntos').props.onClick(); panel.render()
  const modal = panel.nodes().find(node => node.type === 'Modal' && node.props.title === 'Mis adjuntos')
  assert.equal(modal.props.titleSuffix, '2026-001')
  const drop = panel.nodes().find(node => node.props['data-investigation-files-drop'])
  assert.ok(drop)
  assert.equal(panel.button('Agregar archivos').props.disabled, true)
  const input = panel.nodes().find(node => node.type === 'input' && node.props['aria-label'] === 'Seleccionar mis adjuntos')
  assert.equal(input.props.disabled, true)
  assert.equal(modal.props.fixedHeight, true)
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
  const notasShortcut = panel.nodes().find(node => node.props['data-investigation-notes-card'])
  assert.ok(notasShortcut, 'el historial sigue accesible en el lateral derecho')
  assert.equal(notasShortcut.props.children[0].props.children[1].props.children, 1, 'la devolución no cuenta como nota')
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
  assert.equal(panel.nodes().find(node => node.type === 'button' && node.props['aria-label'] === 'Agregar nota'), undefined)
  panel.notesModal().props.onClose(); panel.render()
  panel.nodes().find(node => node.type === 'button' && node.props['aria-label'] === 'Ver mis adjuntos').props.onClick(); panel.render()
  const list = panel.nodes().find(node => node.type === 'Attachments')
  assert.ok(list.props.adjuntos.every(file => !list.props.puedeEliminar(file)))
  assert.equal(panel.button('Agregar archivos').props.disabled, true)
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

test('Mis notas muestra menú en revisión pero no permite modificar fuera de Investigación', () => {
  const panel = fixture({ actividad: [
    { id: 'mine', queja_id: 'A', usuario_id: 'owner', tipo: 'nota', descripcion: 'Nota propia', created_at: '2026-11-11T18:00:00Z' },
    { id: 'other', queja_id: 'A', usuario_id: 'other', tipo: 'nota', descripcion: 'Nota ajena', created_at: '2026-11-11T18:30:00Z' },
  ] })
  panel.select('A', { estado: 'Pendiente de Revisión GC' })
  panel.openNotes()
  const menuButton = panel.nodes().find(node => node.props['aria-label'] === 'Opciones de la nota')
  assert.ok(menuButton)
  assert.equal(menuButton.type, 'button')
  menuButton.props.onClick(); panel.render()
  const edit = panel.button('Editar')
  const remove = panel.button('Eliminar')
  assert.equal(edit.props.disabled, true)
  assert.equal(remove.props.disabled, true)
  const hint = panel.nodes().find(node => node.type === 'p' && typeof node.props.children === 'string' && node.props.children.includes('mientras el caso esté En Investigación'))
  assert.ok(hint)
  assert.equal(panel.noteUpdates.length, 0)
  assert.equal(panel.noteDeletes.length, 0)
})

test('la revisión muestra solo la propuesta y el resultado del responsable', () => {
  const panel = fixture()
  const resultado = () => panel.nodes().find(node => node.type?.name === 'QuejaCierreResumen')?.props.revisionResponsable.estado
  panel.select('A', { estado: 'Pendiente de Revisión GC', resolucion: 'Propuesta enviada' })
  const stages = () => new Set(panel.nodes().map(node => node.props['data-case-stage']).filter(Boolean))
  assert.deepEqual([...stages()], ['analisis', 'resolucion', 'revision'])
  assert.equal(panel.activeStage(), 'revision')
  assert.equal(resultado(), 'Pendiente')
  panel.select('A', { estado: 'Resuelto', resolucion: 'Propuesta enviada' })
  assert.equal(resultado(), 'Aprobada')
  panel.select('A', { estado: 'Finalizado', resolucion: 'Propuesta enviada' })
  assert.equal(panel.activeStage(), 'revision')
  assert.equal(stages().has('finished'), false)
  assert.equal(panel.button('Publicar'), undefined)
  assert.equal(resultado(), 'Aprobada')
})

test('No Procede conserva Análisis y deja Resolución y Revisión indisponibles', () => {
  const panel = fixture()
  panel.select('A', { estado: 'No Procede', resolucion: 'No aplica al alcance.' })
  assert.equal(panel.activeStage(), 'analisis')
  assert.equal(panel.nodes().find(node => node.props['data-case-stage'] === 'resolucion').props.disabled, true)
  assert.equal(panel.nodes().find(node => node.props['data-case-stage'] === 'revision').props.disabled, true)
  assert.equal(panel.button('Ir a Resolución'), undefined)
})

test('guardar el borrador conserva adjuntos a la izquierda sin duplicarlos en el editor', async () => {
  const panel = fixture()
  panel.select('A')
  assert.equal(panel.nodes().some(node => node.props['data-resolution-attachments']), false)
  assert.ok(panel.nodes().some(node => node.props['data-investigation-files-card']))
  panel.editor().props.onChange('Trabajo guardado', 'plain'); panel.render()
  await panel.button('Guardar').props.onClick(); panel.render()
  assert.equal(panel.nodes().some(node => node.props['data-resolution-attachments']), false)
  assert.ok(panel.nodes().some(node => node.props['data-investigation-files-card']))
  assert.equal(panel.button('Guardar'), undefined)
  assert.ok(panel.button('Editar'))
})
