import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

class FixtureNode {
  focusCount = 0
  focus() { this.focusCount++ }
  contains() { return false }
}

function reportHarness({ initial = null, saveError = null, uploadError = null, preparePdf = false } = {}) {
  const slots = [], pendingEffects = new Map(), listeners = new Map(), saves = [], downloads = [], prepared = [], selected = [], pdfUploads = [], attached = []
  let cursor = 0, tree, closed = 0
  const document = {
    addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name) },
    createElement() { return { click() { downloads.push(this.download) }, remove() {} } },
    body: { appendChild() {} },
  }
  const react = {
    useState(value) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(value) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: value }
      return slots[index]
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) {
        pendingEffects.set(index, { effect, deps })
      }
    },
  }
  const operation = { isCurrent: () => true, finish() {} }
  const queryClient = { setQueryData() {} }
  class MockFile {
    constructor(parts, name, options) {
      this.name = name
      this.type = options.type
      this.size = parts.reduce((sum, part) => sum + (part.size ?? part.length ?? 0), 0)
    }
  }
  const { default: Informe } = loadModule('app/quejas/components/QuejaInformeModal.tsx', {
    react,
    '@tanstack/react-query': { useQueryClient: () => queryClient },
    '@/components/Modal': { default: 'Modal' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/LoadingSkeleton': { default: 'LoadingSkeleton' },
    '@/app/quejas/components/QuejaInformeHoja': { default: 'QuejaInformeHoja' },
    '@/lib/queries/useQuejaInforme': { useQuejaInforme: () => ({ data: initial, isFetching: false, isLoading: false, error: null }), quejaInformeKey: id => ['informe', id] },
    '@/lib/queries/useQuejas': {
      useQuejaAdjuntos: () => ({ data: attached }),
      quejaAdjuntosKey: id => ['quejas', 'adjuntos', id],
      fetchQuejaAdjuntos: async () => [...attached],
    },
    '@/lib/services/quejaWorkflowService': {
      esOficioPublicableQueja: (file, id) => file.queja_id === id && !!file.usuario_id,
      async subirAdjuntoQueja(quejaId, file) {
        pdfUploads.push(file)
        if (uploadError && pdfUploads.length === 1) throw uploadError
        const saved = { id: 'pdf-' + pdfUploads.length, queja_id: quejaId, nombre: file.name, tipo_mime: file.type, usuario_id: 'staff', storage_path: 'document_file_123', created_at: new Date().toISOString() }
        attached.push(saved)
        return saved
      },
    },
    '@/lib/services/errorToast': { errorMsg: e => e instanceof Error ? e.message : 'Error' },
    '@/lib/services/quejaInformeService': {
      async guardarQuejaInforme(input) {
        saves.push(input)
        if (saveError) throw saveError
        return { queja_id: input.quejaId, version: input.version + 1, fuente_revision: input.fuenteRevision, contenido: input.contenido }
      },
    },
    '@/lib/utils/quejaInforme': {
      crearPlantillaInforme: () => '## Informe inicial\n\nTexto del caso',
      informeFilename: () => 'Informe.docx',
    },
    '@/hooks/useEntityRequestGuard': { useEntityRequestGuard: () => ({ start: () => operation, captureContext: () => () => true }) },
    'lucide-react': { ChevronDown: 'ChevronDown', FileDown: 'FileDown', FileText: 'FileText', Save: 'Save', TriangleAlert: 'TriangleAlert' },
    '@/lib/utils/quejaInformeWord': { crearInformeWord: async () => new Blob(['word']) },
    '@/lib/utils/quejaInformePdf': { crearInformePdf: async () => new Blob(['pdf']) },
  }, {
    document,
    Node: FixtureNode,
    URL: { createObjectURL: () => 'blob:report', revokeObjectURL() {} },
    window: { setTimeout() {} },
    File: MockFile,
  })

  const props = {
    queja: { id: 'case-1', folio: '2026-2082', revision: 1 },
    anexos: [],
    autor: 'Calidad',
    onClose() { closed++ },
    ...(preparePdf ? { onPreparePdf: async file => { prepared.push(file); return { id: 'pdf-prepared', nombre: file.name, tipo_mime: file.type } },
      onPdfPrepared: file => selected.push(file) } : {}),
  }

  function visit(value, nodes = []) {
    if (Array.isArray(value)) value.forEach(child => visit(child, nodes))
    else if (value?.props) {
      nodes.push(value)
      if (typeof value.type === 'function') visit(value.type(value.props), nodes)
      else {
        visit(value.props.children, nodes)
        visit(value.props.headerActions, nodes)
        visit(value.props.headerLeading, nodes)
      }
    }
    return nodes
  }

  function render() {
    cursor = 0
    tree = Informe(props)
    const nodes = visit(tree)
    for (const node of nodes) {
      if (node.props.ref && typeof node.props.ref === 'object') node.props.ref.current ??= new FixtureNode()
    }
    for (const [index, { effect, deps }] of pendingEffects) {
      slots[index]?.cleanup?.()
      slots[index] = { deps, cleanup: effect() }
    }
    pendingEffects.clear()
    return nodes
  }

  const text = value => Array.isArray(value)
    ? value.map(text).join('')
    : value?.props ? text(value.props.children)
      : typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  const findButton = (nodes, label) => nodes.find(node => node.type === 'Button' && text(node.props.children).includes(label))
  const confirm = nodes => nodes.find(node => node.type === 'Modal' && node.props.variant === 'confirmation')

  render()
  render()
  return {
    render,
    listeners,
    saves,
    downloads,
    prepared,
    selected,
    pdfUploads,
    attached,
    closed: () => closed,
    content: nodes => nodes.find(node => node.type === 'QuejaInformeHoja')?.props.contenido,
    change(value) {
      const editor = render().find(node => node.type === 'QuejaInformeHoja')
      editor.props.onChange(value, 'markdown')
      return render()
    },
    initialize(value) {
      const editor = render().find(node => node.type === 'QuejaInformeHoja')
      editor.props.onInitialized(value)
      return render()
    },
    close() {
      const modal = render().find(node => node.type === 'Modal' && node.props.variant === 'report')
      modal.props.onClose()
      return render()
    },
    confirm,
    findButton,
    text,
  }
}

test('el informe no incorpora acciones adicionales de preparación para cliente', () => {
  const report = reportHarness({ initial: { queja_id: 'case-1', version: 3, fuente_revision: 1, contenido: 'Informe guardado' } })
  assert.equal(report.findButton(report.render(), 'Preparar PDF para cliente'), undefined)
  assert.ok(report.findButton(report.render(), 'Exportar'))
})

test('abrir y cerrar de inmediato o dejar el informe abierto no muestra confirmación', () => {
  const immediate = reportHarness()
  const nodes = immediate.close()
  assert.equal(immediate.confirm(nodes), undefined)
  assert.equal(immediate.closed(), 1)

  const idle = reportHarness()
  const nodesAfterWait = idle.render()
  assert.equal(idle.confirm(nodesAfterWait), undefined)
  assert.equal(idle.confirm(idle.close()), undefined)
  assert.equal(idle.closed(), 1)
})

test('el texto inicial del editor no marca cambios, pero permite guardar la primera versión', async () => {
  const harness = reportHarness()
  const initial = harness.render()
  assert.equal(harness.findButton(initial, 'Guardar').props.disabled, false)
  harness.initialize('## Informe inicial\n\nTexto del caso\n')
  const nodes = harness.close()
  assert.equal(harness.confirm(nodes), undefined)
  assert.equal(harness.closed(), 1)

  const saved = reportHarness()
  await saved.findButton(saved.render(), 'Guardar').props.onClick()
  assert.equal(saved.saves.length, 1)
  assert.equal(saved.confirm(saved.close()), undefined)
})

test('escribir, borrar contenido o cambiar formato muestra confirmación', () => {
  for (const value of ['## Informe inicial\n\nTexto nuevo', '', '## Informe inicial\n\n**Texto del caso**']) {
    const harness = reportHarness()
    const nodes = harness.change(value)
    assert.ok(harness.confirm(harness.close()), `se esperaba confirmación para ${JSON.stringify(value)}`)
    assert.equal(harness.closed(), 0)
    assert.equal(harness.content(nodes), value)
  }
})

test('guardar actualiza la referencia persistida y una edición posterior vuelve a quedar pendiente', async () => {
  const harness = reportHarness()
  harness.change('## Informe inicial\n\nTexto guardado')
  let nodes = harness.render()
  await harness.findButton(nodes, 'Guardar').props.onClick()
  nodes = harness.close()
  assert.equal(harness.confirm(nodes), undefined)
  assert.equal(harness.closed(), 1)
  assert.equal(harness.saves.length, 1)

  const next = reportHarness({ initial: { queja_id: 'case-1', version: 3, fuente_revision: 1, contenido: '## Informe inicial\n\nTexto guardado' } })
  next.change('## Informe inicial\n\nNueva edición')
  assert.ok(next.confirm(next.close()))
})

test('volver al editor conserva el texto y salir sin guardar lo descarta cerrando el informe', () => {
  const harness = reportHarness()
  const edited = '## Informe inicial\n\nTexto que se conserva'
  harness.change(edited)
  let nodes = harness.close()
  let dialog = harness.confirm(nodes)
  assert.equal(dialog.props.dismissOnBackdrop, false)
  assert.equal(dialog.props.title, 'Cambios sin guardar')
  assert.equal(dialog.props.descriptionId, 'queja-informe-unsaved-description')
  assert.equal(dialog.props.headerLeading, undefined)
  assert.equal(harness.text(nodes.find(node => node.props.id === dialog.props.descriptionId)?.props.children), 'Realizaste cambios en este informe que todavía no se han guardado. Si salís ahora, perderás esas modificaciones.')
  const returnButton = harness.findButton(nodes, 'Volver al editor')
  const discardButton = harness.findButton(nodes, 'Salir sin guardar')
  const actions = nodes.find(node => typeof node.props.className === 'string' && node.props.className.includes('grid grid-cols-2 gap-3'))
  assert.ok(actions)
  assert.equal(returnButton.props.autoFocus, true)
  assert.equal(returnButton.props.variant, undefined, 'volver usa el botón primario institucional')
  assert.equal(discardButton.props.variant, 'secondary')
  assert.match(discardButton.props.className, /text-qms-danger/)
  assert.match(discardButton.props.className, /hover:!bg-qms-danger/)
  harness.findButton(nodes, 'Volver al editor').props.onClick()
  nodes = harness.render()
  assert.equal(harness.confirm(nodes), undefined)
  assert.equal(harness.content(nodes), edited)

  nodes = harness.close()
  harness.findButton(nodes, 'Salir sin guardar').props.onClick()
  assert.equal(harness.closed(), 1)
})

test('Escape y la X cancelan el descarte sin cerrar el editor inferior', () => {
  const harness = reportHarness()
  harness.change('## Informe inicial\n\nEdición pendiente')
  const dialog = harness.confirm(harness.close())
  dialog.props.onClose()
  let nodes = harness.render()
  assert.equal(harness.confirm(nodes), undefined)
  assert.equal(harness.closed(), 0)
  assert.equal(harness.content(nodes), '## Informe inicial\n\nEdición pendiente')

  nodes = harness.close()
  const confirmDialog = harness.confirm(nodes)
  confirmDialog.props.onClose()
  nodes = harness.render()
  assert.equal(harness.confirm(nodes), undefined)
  assert.equal(harness.closed(), 0)
})

test('un error al guardar conserva los cambios pendientes y la confirmación', async () => {
  const harness = reportHarness({ saveError: new Error('conflicto de versión') })
  harness.change('## Informe inicial\n\nCambio no persistido')
  const nodes = harness.render()
  await harness.findButton(nodes, 'Guardar').props.onClick()
  assert.ok(harness.confirm(harness.close()))
  assert.equal(harness.closed(), 0)
})

test('exportar Word o PDF no actualiza la referencia persistida', async () => {
  for (const label of ['Exportar a Word', 'Exportar a PDF']) {
    const harness = reportHarness()
    harness.change('## Informe inicial\n\nExportado, pero no guardado')
    let nodes = harness.render()
    harness.findButton(nodes, 'Exportar').props.onClick()
    nodes = harness.render()
    harness.findButton(nodes, label).props.onClick()
    await new Promise(resolve => setImmediate(resolve))
    nodes = harness.close()
    assert.ok(harness.confirm(nodes), `${label} debe dejar el documento pendiente`)
    assert.equal(harness.saves.length, 0)
    assert.equal(harness.closed(), 0)
  }
})

test('reabrir un informe guardado no muestra confirmación sin una nueva edición', () => {
  const saved = { queja_id: 'case-1', version: 3, fuente_revision: 1, contenido: '## Informe inicial\n\nPersistido' }
  const harness = reportHarness({ initial: saved })
  assert.equal(harness.confirm(harness.close()), undefined)
  assert.equal(harness.closed(), 1)
})

test('guardar crea y registra un PDF versionado que el correo puede seleccionar', async () => {
  const report = reportHarness()
  await report.findButton(report.render(), 'Guardar').props.onClick()
  assert.equal(report.saves.length, 1)
  assert.equal(report.pdfUploads.length, 1)
  assert.equal(report.pdfUploads[0].name, 'Informe-v1.pdf')
  assert.equal(report.pdfUploads[0].type, 'application/pdf')
  assert.equal(report.attached.length, 1)
})

test('un fallo al adjuntar no pierde el informe y Guardar reintenta sin nueva versión', async () => {
  const report = reportHarness({ uploadError: new Error('Servicio de archivos no disponible') })
  await report.findButton(report.render(), 'Guardar').props.onClick()
  assert.equal(report.saves.length, 1)
  assert.equal(report.attached.length, 0)
  await report.findButton(report.render(), 'Guardar').props.onClick()
  assert.equal(report.saves.length, 1)
  assert.equal(report.pdfUploads.length, 2)
  assert.equal(report.attached.length, 1)
})
