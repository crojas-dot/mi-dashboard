import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

test('paginación conserva controles HTML accesibles y no envía formularios', () => {
  const { default: Pagination } = loadModule('components/ui/Pagination.tsx', {
    '@/lib/queries/pagination': { PAGE_SIZE: 25 },
  })
  // Renderizar el kit activo detecta atributos descartados por sus wrappers.
  const html = renderToStaticMarkup(createElement(Pagination, { page: 0, count: 75, onChange() {} }))
  const buttons = [...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)]
  assert.equal(buttons.length, 2)
  assert.ok(buttons.every(([, attributes]) => attributes.includes('type="button"')))
  assert.match(buttons[0][1], /disabled=""/)
  assert.match(buttons[0][1], /aria-label="Página anterior"/)
  assert.match(buttons.at(-1)[1], /aria-label="Página siguiente"/)
  assert.doesNotMatch(buttons.at(-1)[1], /\sdisabled(?:=|\s|$)/)
  assert.match(html.replace(/<[^>]+>/g, ''), /Página 1 de 3/)
  const busy = renderToStaticMarkup(createElement(Pagination, { page: 1, count: 75, busy: true, onChange() {} }))
  assert.equal([...busy.matchAll(/<button\b[^>]*disabled=""/g)].length, 2)
})

function modalFixture({ open = true, ...props } = {}) {
  let closes = 0
  const { default: Modal } = loadModule('components/Modal.tsx', {
    react: {
      useEffect() {},
      useId: () => 'parent',
      useRef: (current) => ({ current }),
    },
    'react-dom': { createPortal: (child) => child },
  }, { document: { body: {} } })
  const element = Modal({ open, title: 'Expediente', onClose: () => closes++, children: null, ...props })
  return { element, dialog: element, closes: () => closes }
}

test('diálogo y botón usan sus tokens compartidos sin hex locales', () => {
  const { dialog } = modalFixture()
  const header = dialog.props.children.find(child => child?.props?.['data-modal-header'])
  const { default: Button } = loadModule('components/ui/Button.tsx')
  const button = Button({ children: 'Nueva queja' })
  const recipes = fs.readFileSync('app/styles/components.css', 'utf8')

  assert.match(header.props.className, /\bbg-qms-dark\b/)
  assert.match(button.props.className, /\bui-button-primary\b/)
  assert.match(recipes, /@utility ui-button-primary\s*\{\s*@apply border-qms-primary bg-qms-primary text-white;/)
})

test('Select permite que un ancho de wrapper específico reemplace el ancho de 100%', () => {
  const { default: Select } = loadModule('components/ui/Select.tsx')
  const option = createElement('option', { value: 'paragraph' }, 'Texto normal')
  const fixed = renderToStaticMarkup(createElement(Select, { wrapperClassName: 'mr-1 w-40 shrink-0' }, option))
  const fluid = renderToStaticMarkup(createElement(Select, null, option))
  assert.match(fixed, /class="relative min-w-0 mr-1 w-40 shrink-0"/)
  assert.doesNotMatch(fixed, /class="relative[^"]*w-full/)
  assert.match(fluid, /class="relative min-w-0 w-full"/)
  const styles = fs.readFileSync('app/styles/components.css', 'utf8')
  assert.match(styles, /\.mis-quejas-resolution-editor \[data-rich-text-toolbar\]\s*\{[^}]*flex-wrap:\s*wrap;[^}]*overflow:\s*visible;/)
  assert.match(styles, /\.mis-quejas-resolution-editor\[data-rich-text-readonly\] \[data-rich-text-viewport\]\s*\{[^}]*overflow-y:\s*auto;/)
})

test('cancelación nativa del diálogo consume Escape antes del panel de fondo', () => {
  const top = modalFixture()
  const effects = []
  const event = { key: 'Escape', defaultPrevented: false, preventDefault() { effects.push('prevent') }, stopPropagation() { effects.push('stop') } }
  top.dialog.props.onCancel(event)
  assert.equal(top.closes(), 1)
  assert.deepEqual(effects, ['prevent', 'stop'])
})

test('cancelar el selector de archivos no cierra el expediente que lo abrió', () => {
  const { dialog, closes } = modalFixture({ variant: 'workspace' })
  const input = { tagName: 'INPUT' }
  let prevented = false
  // El cancel del input burbujea hasta el diálogo: su target no es el diálogo.
  dialog.props.onCancel({ target: input, currentTarget: dialog, preventDefault() { prevented = true }, stopPropagation() {} })
  assert.equal(closes(), 0)
  assert.equal(prevented, false)
  // Escape con el foco en el propio diálogo sí conserva el cierre.
  dialog.props.onCancel({ target: dialog, currentTarget: dialog, preventDefault() {}, stopPropagation() {} })
  assert.equal(closes(), 1)
})

test('arrastrar desde el contenido al fondo no cierra el modal; pulsar el fondo sí', () => {
  const { dialog, closes } = modalFixture()
  const overlay = { getBoundingClientRect: () => ({ left: 10, top: 10, right: 100, bottom: 100 }) }
  dialog.props.onMouseDown({ target: {}, currentTarget: overlay })
  dialog.props.onClick({ target: overlay, currentTarget: overlay, clientX: 0, clientY: 0 })
  assert.equal(closes(), 0)
  dialog.props.onMouseDown({ target: overlay, currentTarget: overlay, clientX: 0, clientY: 0 })
  dialog.props.onClick({ target: overlay, currentTarget: overlay, clientX: 0, clientY: 0 })
  assert.equal(closes(), 1)
})

test('un documento con cierre solo por X consume Escape y fondo sin cerrarse', () => {
  const { dialog, closes } = modalFixture({ variant: 'document', dismissOnEscape: false, dismissOnBackdrop: false })
  const effects = []
  dialog.props.onCancel({ preventDefault() { effects.push('prevent') }, stopPropagation() { effects.push('stop') } })
  const overlay = { getBoundingClientRect: () => ({ left: 10, top: 10, right: 100, bottom: 100 }) }
  const event = { target: overlay, currentTarget: overlay, clientX: 0, clientY: 0 }
  dialog.props.onMouseDown(event); dialog.props.onClick(event)
  assert.equal(closes(), 0)
  assert.deepEqual(effects, ['prevent', 'stop'])
  const header = dialog.props.children.find(child => child?.props?.['data-modal-header'])
  const closeButton = header.props.children[1].props.children.at(-1)
  closeButton.props.onClick()
  assert.equal(closes(), 1)
})

test('un modal cerrado no monta un diálogo ni modifica el scroll de otro', () => {
  assert.equal(modalFixture({ open: false }).element, null)
})

// Ejecutar los efectos reales permite comprobar la contabilidad de scroll y el
// orden de diálogos nativos sin red, sesión de usuario ni un navegador compartido.
function modalLifecycleHarness({ mobile = false } = {}) {
  let hooks
  const pendingMutations = new Set()
  const observers = new Set(), dialogs = [], topLayer = [], calls = []
  const media = {
    matches: mobile, listeners: new Set(),
    addEventListener(_name, listener) { this.listeners.add(listener) },
    removeEventListener(_name, listener) { this.listeners.delete(listener) },
  }
  class Element {
    isConnected = true
    focus() { document.activeElement = this }
    contains(other) { for (let node = other; node; node = node.parent) if (node === this) return true; return false }
  }
  const origin = new Element()
  const document = {
    body: Object.assign(new Element(), { style: { overflow: 'auto' } }),
    activeElement: origin,
    querySelectorAll(selector) { return (selector === 'dialog:modal' ? topLayer : dialogs).filter(dialog => dialog.isConnected) },
  }
  class Dialog extends Element {
    open = false
    modal = false
    previousFocus = null
    showModal() {
      assert.equal(this.open, false, 'showModal exige un diálogo cerrado')
      this.previousFocus = document.activeElement
      this.open = true; this.modal = true
      topLayer.push(this); document.activeElement = this
      calls.push(['showModal', this]); if (this.isConnected) pendingMutations.add('attributes')
    }
    show() {
      assert.equal(this.open, false, 'show exige un diálogo cerrado')
      this.previousFocus = document.activeElement
      this.open = true; this.modal = false
      document.activeElement = this
      calls.push(['show', this]); if (this.isConnected) pendingMutations.add('attributes')
    }
    close() {
      if (!this.open) return
      this.open = false; this.modal = false
      const index = topLayer.indexOf(this)
      if (index >= 0) topLayer.splice(index, 1)
      if (document.activeElement === this) document.activeElement = this.previousFocus ?? document.body
      calls.push(['close', this]); if (this.isConnected) pendingMutations.add('attributes')
    }
    matches(selector) { return selector === ':modal' && this.open && this.modal }
    querySelectorAll() { return [] }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback }
    observe(_target, options) { this.options = options; observers.add(this) }
    disconnect() { observers.delete(this) }
  }
  const { default: Modal } = loadModule('components/Modal.tsx', {
    react: {
      useEffect(effect) { hooks.effects.push(effect) },
      useId: () => 'test-modal',
      useRef(value) { const ref = { current: value }; hooks.refs.push(ref); return ref },
    },
  }, { document, window: { matchMedia: () => media }, HTMLElement: Element, MutationObserver })
  const flush = () => {
    // Un observer de open no puede cerrar/reabrir su propio diálogo sin fin.
    for (let count = 0; pendingMutations.size > 0; count++) {
      assert.ok(count < 20, 'el cambio de modalidad debe converger')
      const types = [...pendingMutations]
      pendingMutations.clear()
      for (const observer of [...observers]) {
        if (types.some(type => observer.options[type])) observer.callback(types.map(type => ({ type })))
      }
    }
  }
  const mount = (props = {}, existing) => {
    hooks = { effects: [], refs: [] }
    const { parent, ...modalProps } = props
    const element = Modal({ open: true, title: 'Expediente', children: null, onClose() {}, ...modalProps })
    const dialog = existing ?? new Dialog()
    dialog.parent = parent?.dialog
    if (!existing) dialogs.push(dialog)
    hooks.refs[0].current = dialog
    const cleanups = hooks.effects.map(effect => effect())
    flush()
    return { element, dialog,
      close() { cleanups.forEach(cleanup => cleanup?.()); flush() },
      unmount() {
        // React retira el DOM antes de ejecutar el cleanup de useEffect.
        dialog.isConnected = false
        const index = topLayer.indexOf(dialog)
        if (index >= 0) topLayer.splice(index, 1)
        pendingMutations.add('childList')
        cleanups.forEach(cleanup => cleanup?.())
        flush()
      },
    }
  }
  return { document, calls, mount, topLayer, flush, Element, origin,
    resize(value) { media.matches = value; for (const listener of [...media.listeners]) listener(); flush() },
  }
}

test('workspace de escritorio deja scroll y Tab libres; móvil conserva modalidad nativa', () => {
  const desktop = modalLifecycleHarness()
  const workspace = desktop.mount({ variant: 'workspace' })
  assert.equal(workspace.dialog.modal, false)
  assert.equal(desktop.document.body.style.overflow, 'auto')
  let prevented = false
  workspace.element.props.onKeyDown({ key: 'Tab', currentTarget: workspace.dialog, preventDefault() { prevented = true } })
  assert.equal(prevented, false)
  desktop.resize(true)
  assert.equal(workspace.dialog.modal, true)
  assert.equal(desktop.document.body.style.overflow, 'hidden')
  desktop.resize(false)
  assert.equal(workspace.dialog.modal, false)
  assert.equal(desktop.document.body.style.overflow, 'auto')
  workspace.close()
})

test('workspace ampliado y diálogo superior conservan el bloqueo hasta cerrar el último', () => {
  const browser = modalLifecycleHarness()
  const workspace = browser.mount({ variant: 'workspace', expanded: true })
  const editor = browser.mount({ variant: 'document' })
  assert.deepEqual(browser.topLayer, [workspace.dialog, editor.dialog])
  assert.equal(browser.document.body.style.overflow, 'hidden')
  editor.close()
  assert.equal(browser.document.body.style.overflow, 'hidden')
  workspace.close()
  assert.equal(browser.document.body.style.overflow, 'auto')
})

test('un lateral de consulta dentro del expediente ampliado comparte su plano sin otro bloqueo modal', () => {
  const browser = modalLifecycleHarness()
  const workspace = browser.mount({ variant: 'workspace', expanded: true })
  const analysis = browser.mount({ variant: 'workspace', size: 'sm', parent: workspace })
  assert.equal(analysis.dialog.open, true)
  assert.equal(analysis.dialog.modal, false)
  assert.deepEqual(browser.topLayer, [workspace.dialog])
  assert.match(analysis.element.props.className, /lg:w-\[560px\]/)
  analysis.close()
  assert.equal(workspace.dialog.open, true)
  assert.equal(browser.document.body.style.overflow, 'hidden')
  workspace.close()
  assert.equal(browser.document.body.style.overflow, 'auto')
})

test('ampliar y reducir el análisis anidado conserva el expediente y el bloqueo correctos', () => {
  const browser = modalLifecycleHarness()
  const workspace = browser.mount({ variant: 'workspace', expanded: true })
  let analysis = browser.mount({ variant: 'workspace', size: 'sm', parent: workspace })
  const node = analysis.dialog
  analysis.close()
  analysis = browser.mount({ variant: 'workspace', size: 'sm', parent: workspace, expanded: true }, node)
  assert.deepEqual(browser.topLayer, [workspace.dialog, node])
  analysis.close()
  analysis = browser.mount({ variant: 'workspace', size: 'sm', parent: workspace }, node)
  assert.equal(node.open, true)
  assert.equal(node.modal, false)
  assert.deepEqual(browser.topLayer, [workspace.dialog])
  analysis.close(); workspace.close()
  assert.equal(browser.document.body.style.overflow, 'auto')
})

test('cambiar a móvil no coloca workspace encima del editor abierto', () => {
  const browser = modalLifecycleHarness()
  const workspace = browser.mount({ variant: 'workspace' })
  const editor = browser.mount({ variant: 'document' })
  browser.resize(true)
  assert.equal(browser.topLayer.at(-1), editor.dialog)
  assert.equal(workspace.dialog.modal, false)
  editor.close()
  assert.equal(workspace.dialog.modal, true)
  assert.equal(browser.topLayer.at(-1), workspace.dialog)
  assert.equal(browser.document.body.style.overflow, 'hidden')
  workspace.close()
  assert.equal(browser.document.body.style.overflow, 'auto')
})

test('cambiar a escritorio conserva el editor superior y libera scroll al cerrarlo', () => {
  const browser = modalLifecycleHarness({ mobile: true })
  const workspace = browser.mount({ variant: 'workspace' })
  const editor = browser.mount({ variant: 'document' })
  browser.resize(false)
  assert.equal(browser.topLayer.at(-1), editor.dialog)
  assert.equal(workspace.dialog.modal, true)
  editor.close()
  assert.equal(workspace.dialog.modal, false)
  assert.equal(browser.document.body.style.overflow, 'auto')
  workspace.close()
})

test('la retirada del DOM del editor retoma el cambio de modalidad aplazado', () => {
  const browser = modalLifecycleHarness()
  const workspace = browser.mount({ variant: 'workspace' })
  const editor = browser.mount({ variant: 'document' })
  browser.resize(true)
  assert.equal(workspace.dialog.modal, false)
  editor.unmount()
  assert.equal(workspace.dialog.modal, true)
  assert.equal(browser.document.body.style.overflow, 'hidden')
  workspace.unmount()
  assert.equal(browser.document.body.style.overflow, 'auto')
})

test('Escape desde el editor pertenece a su diálogo y no cierra el expediente de fondo', () => {
  const browser = modalLifecycleHarness()
  let closedWorkspace = 0, closedEditor = 0
  const workspace = browser.mount({ variant: 'workspace', onClose() { closedWorkspace++ } })
  const editor = browser.mount({ variant: 'document', onClose() { closedEditor++ } })
  const editable = new browser.Element()
  editable.closest = selector => selector === 'dialog' ? editor.dialog : editable
  const effects = []
  const event = { key: 'Escape', target: editable, currentTarget: editor.dialog, preventDefault() { effects.push('prevent') }, stopPropagation() { effects.push('stop') } }
  editor.element.props.onKeyDownCapture(event)
  workspace.element.props.onKeyDownCapture({ ...event, currentTarget: workspace.dialog })
  assert.equal(closedEditor, 1)
  assert.equal(closedWorkspace, 0)
  assert.deepEqual(effects, ['prevent', 'stop'])
  editor.close(); workspace.close()
})

test('un documento que exige X también conserva la vista al usar Escape desde Tiptap', () => {
  const browser = modalLifecycleHarness()
  let closed = 0
  const editor = browser.mount({ variant: 'document', dismissOnEscape: false, onClose() { closed++ } })
  const editable = new browser.Element()
  editable.closest = selector => selector === 'dialog' ? editor.dialog : editable
  const effects = []
  editor.element.props.onKeyDownCapture({ key: 'Escape', target: editable, currentTarget: editor.dialog, preventDefault() { effects.push('prevent') }, stopPropagation() { effects.push('stop') } })
  assert.equal(closed, 0)
  assert.deepEqual(effects, ['prevent', 'stop'])
  editor.close()
})

test('el cierre devuelve foco al origen conectado cuando el navegador lo deja en body', () => {
  const browser = modalLifecycleHarness()
  const workspace = browser.mount({ variant: 'workspace' })
  browser.document.activeElement = browser.document.body
  workspace.close()
  assert.equal(browser.document.activeElement, browser.origin)
})

test('el documento conserva altura fija y encabezado de lectura desde la primera apertura', () => {
  const { dialog } = modalFixture({ variant: 'document', size: 'xl' })
  const header = dialog.props.children.find(child => child?.props?.['data-modal-header'])
  assert.match(dialog.props.className, /\bh-\[90dvh\]/)
  assert.match(dialog.props.className, /\bmax-w-\[1040px\]/)
  assert.match(header.props.className, /\bbg-qms-surface\b/)
  assert.doesNotMatch(header.props.className, /\bbg-qms-dark\b/)
})

test('el editor de informe ocupa el viewport sin alterar las variantes existentes', () => {
  const { dialog } = modalFixture({ variant: 'report', headerLeading: 'document icon', title: 'Informe del expediente · 2026-001' })
  const header = dialog.props.children.find(child => child?.props?.['data-modal-header'])
  const [titleGroup, actions] = header.props.children
  assert.match(dialog.props.className, /\bfixed\b/)
  assert.match(dialog.props.className, /\binset-0\b/)
  assert.match(dialog.props.className, /\bm-0\b/)
  assert.match(dialog.props.className, /\bh-dvh\b/)
  assert.match(dialog.props.className, /\bw-screen\b/)
  assert.match(dialog.props.className, /\bmax-w-none\b/)
  assert.match(dialog.props.className, /\brounded-none\b/)
  assert.match(dialog.props.className, /\bshadow-none\b/)
  assert.match(header.props.className, /\bh-14\b/)
  assert.match(header.props.className, /\bflex-nowrap\b/)
  assert.equal(titleGroup.props.children[0], 'document icon')
  assert.equal(titleGroup.props.children[1].props.children, 'Informe del expediente · 2026-001')
  assert.match(titleGroup.props.children[1].props.className, /\btext-base\b/)
  assert.match(actions.props.children.at(-1).props.className, /\bh-9\b/)
  assert.equal(actions.props.children.at(-1).props['aria-label'], 'Cerrar Informe del expediente · 2026-001')
  assert.match(dialog.props.children[1].props.className, /flex min-h-0 flex-1 flex-col overflow-hidden/)
  const { dialog: documentDialog } = modalFixture({ variant: 'document', size: 'xl' })
  assert.match(documentDialog.props.className, /\bh-\[90dvh\]/)
  assert.match(documentDialog.props.className, /\bmax-w-\[1040px\]/)
})

test('los diálogos usan cabecera clara y la variante alta reserva espacio a la lista de adjuntos', () => {
  const { dialog } = modalFixture({ tall: true, variant: 'dialog' })
  const header = dialog.props.children.find(child => child?.props?.['data-modal-header'])
  assert.match(dialog.props.className, /h-\\[min\\(76dvh,720px\\)\\]/)
  assert.match(header.props.className, /bg-qms-surface/)
  assert.doesNotMatch(header.props.className, /bg-qms-dark/)
  assert.match(dialog.props.children[1].props.className, /flex min-h-0 flex-1 flex-col overflow-hidden/)

  const workspace = modalFixture({ variant: 'workspace', expanded: true, headerCenter: 'Etapas del expediente' })
  const workspaceHeader = workspace.dialog.props.children.find(child => child?.props?.['data-modal-header'])
  assert.match(workspaceHeader.props.className, /@min-\\[1100px\\]\\/workspace:grid-cols-\\[220px_minmax\\(0,1fr\\)_260px\\]/)
  assert.equal(workspaceHeader.props.children[1].props.children, 'Etapas del expediente')
  assert.match(workspaceHeader.props.children[1].props.className, /@min-\\[1100px\\]\\/workspace:px-0/)
})

test('Ver análisis permite recorrer las pestañas con teclado y conserva la separación de evidencias', () => {
  const panel = fs.readFileSync('app/mis-quejas/components/QuejaAnalisisPanel.tsx', 'utf8')
  const files = fs.readFileSync('app/mis-quejas/components/QuejaAdjuntosInvestigacion.tsx', 'utf8')
  assert.ok(panel.includes("['ArrowLeft', 'ArrowRight', 'Home', 'End']"))
  assert.ok(panel.includes("tabIndex={activeTab === id ? 0 : -1}"))
  assert.ok(panel.includes("onKeyDown={event => handleTabKeyDown(event, id)}"))
  assert.ok(panel.includes("changeTab(tabs[nextIndex].id)"))
  assert.ok(panel.includes("querySelectorAll<HTMLButtonElement>('[role=\"tab\"]')[nextIndex]?.focus()"))
  assert.ok(panel.includes("props.adjuntos.filter(adjunto => !adjunto.usuario_id)"))
  assert.ok(panel.includes('layout="rows" hideGroupTitle'))
  assert.ok(files.includes('aria-label="Seleccionar mis adjuntos"'))
  assert.ok(files.includes('aria-label="Lista de mis adjuntos"'))
})

test('modales fijos mantienen el encabezado de referencia sin alterar los diálogos normales', () => {
  const { dialog } = modalFixture({
    title: 'Notas de investigación', titleSuffix: '2026-091',
    size: 'lg', variant: 'dialog', fixedHeight: true, footer: 'Nueva nota',
  })
  assert.ok(dialog.props.className.includes('h-[min(600px,90dvh)]'))
  assert.ok(dialog.props.className.includes('max-w-[672px]'))
  const header = dialog.props.children.find(child => child?.props?.['data-modal-header'])
  const title = header.props.children[0].props.children[1]
  assert.ok(header.props.className.includes('sm:px-6 sm:py-4'))
  assert.ok(title.props.className.includes('text-[17px] font-semibold'))
  const titleHtml = renderToStaticMarkup(title)
  assert.ok(titleHtml.includes('Notas de investigación'))
  assert.ok(titleHtml.includes('· 2026-091'))
  assert.ok(titleHtml.includes('font-normal text-qms-muted'))

  const regular = modalFixture({ variant: 'dialog', size: 'lg', title: 'Sin cambios' })
  assert.ok(regular.dialog.props.className.includes('max-w-[700px]'))
  const regularHeader = regular.dialog.props.children.find(child => child?.props?.['data-modal-header'])
  assert.equal(regularHeader.props.children[0].props.children[1].props.children, 'Sin cambios')
})

test('tarjetas de adjuntos no repiten el encabezado de evidencias y dejan acciones disponibles', () => {
  const source = fs.readFileSync('components/quejas/ListaAdjuntos.tsx', 'utf8')
  const modal = fs.readFileSync('app/mis-quejas/components/QuejaAdjuntosInvestigacion.tsx', 'utf8')
  const notes = fs.readFileSync('app/mis-quejas/components/QuejaNotasPanel.tsx', 'utf8')
  const styles = fs.readFileSync('app/styles/components.css', 'utf8')
  assert.ok(source.includes("layout !== 'modal' && <p"))
  assert.ok(source.includes("layout === 'modal' ? ("))
  assert.ok(source.includes('sm:group-focus-within:opacity-100'))
  assert.ok(source.includes('onPreview(a)'))
  assert.ok(source.includes('onDownload(a)'))
  assert.match(modal, /data-attachment-list-scroll data-case-scroll[^>]*\[will-change:transform\]/)
  assert.match(notes, /data-investigation-notes-scroll data-case-scroll[^>]*\[will-change:transform\]/)
  assert.ok(notes.includes('className="absolute right-3 bottom-3'))
  assert.ok(!notes.includes('<Button size="icon" aria-label="Agregar nota"'))
  assert.ok(!styles.includes('.qms-compact-modal-scroll'))
})

test('el progreso del encabezado descuenta el gutter real del editor', () => {
  const { dialog } = modalFixture({ variant: 'workspace', expanded: true, headerCenter: 'Proceso' })
  const header = dialog.props.children.find(child => child?.props?.['data-modal-header'])
  assert.equal(header.props['data-case-header-grid'], true)
  assert.match(header.props.className, /grid-cols-\\[220px_minmax/)
  const stylesheet = fs.readFileSync('app/styles/components.css', 'utf8')
  assert.match(stylesheet, /data-case-header-grid="true"/)
  assert.match(stylesheet, /padding-right: calc\\(1rem \\+ var\\(--qms-case-scrollbar-width, 0px\\)\\)/)
  const shared = fs.readFileSync('app/quejas/components/QuejaExpedientePanels.tsx', 'utf8')
  assert.match(shared, /offsetWidth - scrollport.clientWidth/)
  assert.match(shared, /--qms-case-scrollbar-width/)
})

test('la confirmación de cambios usa un diálogo compacto claro y bloquea el cierre exterior', () => {
  const { dialog, closes } = modalFixture({
    variant: 'confirmation',
    size: 'sm',
    descriptionId: 'unsaved-description',
    dismissOnBackdrop: false,
  })
  const header = dialog.props.children.find(child => child?.props?.['data-modal-header'])
  const [titleGroup, actions] = header.props.children
  assert.match(dialog.props.className, /\bmax-w-\[480px\]/)
  assert.match(dialog.props.className, /\brounded-\[12px\]/)
  assert.match(dialog.props.className, /\bbg-white\b/)
  assert.match(dialog.props.className, /\bborder-qms-border\b/)
  assert.equal(dialog.props['aria-describedby'], 'unsaved-description')
  assert.equal(titleGroup.props.children[0], undefined)
  assert.equal(titleGroup.props.children[1].props.children, 'Expediente')
  assert.match(titleGroup.props.children[1].props.className, /\btext-lg\b/)
  assert.match(header.props.className, /\bbg-white\b/)
  assert.equal(actions.props.children.at(-1).props['aria-label'], 'Cerrar Expediente')
  assert.ok(dialog.props.children.some(child => child?.props?.className === 'min-h-0 flex-1 overflow-y-auto bg-white'))
  const overlay = { getBoundingClientRect: () => ({ left: 10, top: 10, right: 100, bottom: 100 }) }
  const outside = { target: overlay, currentTarget: overlay, clientX: 0, clientY: 0 }
  dialog.props.onMouseDown(outside); dialog.props.onClick(outside)
  assert.equal(closes(), 0)
  dialog.props.onCancel({ preventDefault() {}, stopPropagation() {} })
  assert.equal(closes(), 1, 'Escape cierra solo la confirmación mediante su callback cancelar')
})

function complaintPanelFixture() {
  let cursor = 0, changed = false, entity = null, tree, closed = 0
  const slots = []
  const noOp = () => {}
  const { default: Panel } = loadModule('app/quejas/components/QuejaDetalleModal.tsx', {
    '@/app/quejas/components/QuejaInformeModal': { default: 'Informe' },
    '@/app/quejas/components/QuejaRespuestaClienteModal': { default: 'Response' },
    react: {
      useEffect() {}, useMemo: create => create(),
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i] },
      useState(initial) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
        return [slots[i], value => {
          const next = typeof value === 'function' ? value(slots[i]) : value
          if (!Object.is(slots[i], next)) { slots[i] = next; changed = true }
        }]
      },
    },
    '@/components/Modal': { default: 'Modal' },
    '@/app/quejas/components/AreaQuejaCatalogo': { default: 'AreaCatalog' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Select': { default: 'Select' },
    '@/components/ui/Input': { default: 'Input' },
    '@/components/ui/RichTextEditor': { default: 'RichTextEditor' },
    '@/components/quejas/RegistroQuejaGC': { default: 'Register' },
    '@/app/quejas/components/AreaQuejaControl': { default: 'AreaControl' },
    '@/components/quejas/AdjuntoPreviewModal': { default: 'Preview' },
    '@/components/quejas/ListaAdjuntos': { default: 'Attachments' },
    '@/components/usuarios/ConfirmDialog': { default: 'Confirm' },
    '@/lib/queries/useUsuarios': { useUsuarios: () => ({}) },
    '@/lib/queries/useQuejaComentarios': { useQuejaComentarios: () => ({}), useCrearQuejaComentario: () => ({}) },
    '@/lib/queries/useQuejaActividad': { useQuejaActividad: () => ({}) },
    '@/lib/queries/useQuejaSeguimiento': { useQuejaPlazos: () => ({}), useQuejaCorreos: () => ({}) },
    '@/lib/queries/useQuejaPublicacion': { usePublicacionQuejasDisponible: () => ({ data: false }) },
    '@/lib/queries/useQuejas': { useQuejaAdjuntos: () => ({}) },
    '@/lib/services/quejaWorkflowService': {},
    '@/lib/services/errorToast': { showError: noOp, showSuccess: noOp },
    '@/lib/store/auth-store': { useAuthStore: select => select({ user: { id: 'test-admin', rol: 'admin' } }) },
    '@/hooks/useEntityRequestGuard': { useEntityRequestGuard: () => ({ invalidate: noOp }) },
    '@/hooks/useQuejaAttachmentActions': { useQuejaAttachmentActions: () => ({ previewAdjunto: null, confirmarEliminacion: null }) },
  })
  const render = () => {
    do {
      changed = false; cursor = 0
      tree = Panel({ queja: entity, onUpdated: noOp, onClose() { closed++ } })
    } while (changed)
  }
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children), ...visit(value.props.headerActions), ...visit(value.props.footer), ...visit(value.props.compact), ...visit(value.props.cycle), ...visit(value.props.action), ...visit(value.props.requestFooter), ...visit(value.props.headerCenter)] : []
  const text = value => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
  const nodes = () => visit(tree)
  return { render, nodes, closed: () => closed,
    select(id, estado = 'Recibido') { entity = id ? { id, folio: '2026-001', revision: 1, estado, cliente_nombre: 'Persona de prueba' } : null; render() },
    workspace: () => nodes().find(node => node.type === 'Modal' && node.props.variant === 'workspace'),
    editor: () => nodes().find(node => node.type === 'Modal' && node.props.variant === 'document'),
    button: label => nodes().find(node => node.type === 'Button' && (node.props['aria-label'] === label || text(node) === label)),
  }
}

test('cerrar el expediente ampliado y volver a abrirlo restablece el panel lateral', () => {
  const panel = complaintPanelFixture()
  panel.select('test-A')
  assert.equal(panel.workspace().props.expanded, false)
  panel.button('Ampliar expediente').props.onClick(); panel.render()
  assert.equal(panel.workspace().props.expanded, true)
  panel.workspace().props.onClose(); panel.render()
  assert.equal(panel.closed(), 1)
  assert.equal(panel.workspace().props.expanded, false)
  panel.select(null); panel.select('test-A')
  assert.equal(panel.workspace().props.expanded, false)
})

test('Quejas ofrece Generar expediente solo al preparar el cierre tras revisión de Calidad', () => {
  const panel = complaintPanelFixture()
  panel.select('test-A')
  const workspace = panel.nodes().find(node => node.type?.name === 'CaseWorkspace')
  assert.equal(workspace.props.cyclePlacement, 'header')
  assert.ok(panel.workspace().props.headerCenter)
  assert.equal(panel.nodes().some(node => node.props['data-close-report-shortcut']), false)
  assert.equal(panel.button('Generar expediente'), undefined)
  const cards = panel.nodes().filter(node => node.type?.name === 'CaseSidebarShortcut')
  assert.deepEqual(cards.map(card => card.props.actionLabel), ['Ver actividad'])
  panel.select('test-A', 'Pendiente de Revisión GC')
  assert.equal(panel.button('Generar expediente'), undefined)
  panel.select('test-A', 'En Investigación')
  assert.equal(panel.button('Generar expediente'), undefined)
  panel.select('test-A', 'Resuelto')
  assert.ok(panel.nodes().some(node => node.props['data-close-report-shortcut']))
  assert.ok(panel.button('Generar expediente'))
  assert.ok(panel.button('Redactar respuesta'))
  panel.button('Generar expediente').props.onClick(); panel.render()
  assert.ok(panel.nodes().some(node => node.type === 'Informe'))
  const headerButtons = panel.workspace().props.headerActions.props.children
  assert.doesNotMatch(JSON.stringify(headerButtons), /Generar expediente|Ver actividad/)
})

test('Respuesta al cliente solo selecciona PDF oficial y conserva un único scroll espacioso', () => {
  const response = fs.readFileSync('app/quejas/components/QuejaRespuestaClienteModal.tsx', 'utf8')
  const editor = fs.readFileSync('app/quejas/components/QuejaCorreoEditor.tsx', 'utf8')
  const report = fs.readFileSync('app/quejas/components/QuejaInformeModal.tsx', 'utf8')
  const service = fs.readFileSync('lib/services/quejaWorkflowService.ts', 'utf8')
  const writeStart = response.indexOf("async function write(kind: 'save' | 'publish' | 'finish')")
  const uploadStart = response.indexOf('async function upload(file: File)')
  assert.ok(writeStart >= 0 && uploadStart > writeStart)
  const writeCode = response.slice(writeStart, uploadStart)
  assert.ok(!writeCode.includes('crearInformePdf'))
  assert.ok(!writeCode.includes('crearInformeWord'))
  assert.ok(!writeCode.includes('props.onSubir('))
  assert.ok(!response.includes('async function generarExpediente()'))
  assert.ok(!response.includes('data-response-generate'))
  assert.ok(response.includes("function ultimoPdfGenerado("))
  assert.ok(response.includes("file.nombre === name"))
  assert.ok(response.includes("file.tipo_mime.toLowerCase() === 'application/pdf'"))
  assert.ok(response.includes('accept="application/pdf,.pdf"'))
  assert.ok(response.includes('data-response-compose'))
  assert.ok(response.includes('data-response-attachments'))
  assert.ok(response.includes('data-response-selected-file'))
  assert.ok(response.includes('aria-label="Quitar PDF seleccionado"'))
  assert.ok(response.includes('setPreviewFile(selectedFile)'))
  assert.ok(response.includes('size="mail"'))
  assert.ok(response.includes('onOficioChange={value => change({ numeroOficio: value })}'))
  assert.ok(!response.includes('Seleccionar PDF oficial'))
  assert.ok(!response.includes('Sin documento oficial seleccionado.'))
  assert.ok(editor.includes("maxLength={REGISTRO_QUEJA_LIMITES.oficio}"))
  assert.ok(editor.includes("min-h-[16rem] w-full flex-1 resize-none"))
  assert.ok(editor.includes('bg-transparent'))
  assert.ok(editor.includes('aria-label="Redactar correo al cliente"'))
  assert.ok(editor.includes('placeholder="Escriba su mensaje aquí..."'))
  assert.ok(editor.includes("maxLength={CORREO_QUEJA_LIMITES.cuerpo}"))
  assert.ok(report.includes('async function guardar()'))
  assert.ok(report.includes('await subirAdjuntoQueja(queja.id, archivo)'))
  assert.ok(report.includes('informePdfFilename(queja.folio, result.version)'))
  assert.ok(report.includes("import('@/lib/utils/quejaInformePdf')"))
  assert.ok(!report.includes('Preparar PDF para cliente'))
  assert.ok(service.includes("adjunto.tipo_mime.toLowerCase() !== 'application/pdf'"))
})


test('el scrollport del expediente se promueve a capa compuesta al ampliar', () => {
  const { CaseWorkspace } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
  const html = renderToStaticMarkup(createElement(CaseWorkspace, { documentKey: 'test-A', expanded: true, compact: null, cycle: null, action: null }, createElement('p', null, 'Descripción')))
  // Sin la promoción, el ancho ampliado obliga a repintar en el hilo principal y el scroll se degrada.
  assert.match(html, /data-case-scroll[^>]*\[will-change:transform\]/)
  // Una capa translúcida obliga a mezclar el ancho completo en cada frame al ampliar.
  assert.match(html, /data-case-scroll[^>]*bg-qms-hover-bg/)
})

test('el expediente ampliado con solicitud en lateral deja el avance en la línea superior', () => {
  const { CaseWorkspace, CaseRequestHeader, CaseCycle } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
  const queja = { id: 'q-1', estado: 'Pendiente de Revisión GC', cliente_nombre: 'Persona de prueba', email_cliente: 'persona@example.com', telefono: '60000000', fecha: '2026-11-05T10:00:00Z', tipo: 'Afectación' }
  const cycle = createElement(CaseCycle, { queja, compact: true, line: true, variant: 'plain' })
  const request = createElement(CaseRequestHeader, { queja, variant: 'panel', showReceivedAt: true })
  const html = renderToStaticMarkup(createElement(CaseWorkspace, { documentKey: 'test-A', expanded: true, cyclePlacement: 'top', request, cycle, action: createElement('aside', null, 'Acción') }, createElement('main', { 'data-case-document': true }, 'Descripción')))
  // El avance del proceso vive en la línea horizontal superior del expediente ampliado.
  assert.match(html, /data-case-top-cycle/)
  assert.match(html, /<ol[^>]*aria-label="Gestión de Calidad/)
  assert.match(html, /data-case-top-cycle-layout[^>]*max-w-\[1600px\]/)
  assert.match(html, /data-case-cycle-track/)
  assert.match(html, /data-case-cycle-label[^>]*>Estado del trámite<\/div>/)
  // La solicitud se presenta en el lateral izquierdo y el documento ocupa el centro.
  assert.match(html, /data-case-request/)
  assert.match(html, /Persona de prueba/)
  assert.doesNotMatch(html, /Datos de la solicitud/)
  const sharedColumns = '@min-[1100px]:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(220px,240px)]'
  assert.equal(html.split(sharedColumns).length - 1, 2)
  assert.match(html, /data-case-layout[^>]*@min-\[1100px\]:pl-3/)
  assert.match(html, /data-case-request[^]*<dl class="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm">/)
  assert.match(html, /\[overflow-wrap:anywhere\]/)
  assert.match(html, /whitespace-nowrap text-qms-muted">Evaluación<\/span>/)
  assert.match(html, /whitespace-nowrap font-semibold text-qms-primary">Revisión de Calidad<\/span>/)
  assert.doesNotMatch(html, /sr-only @min-\[1100px\]:not-sr-only/)
  assert.match(html, /<ol[^>]*class="flex min-w-max items-center gap-0"/)
  assert.match(html, /data-case-cycle-track[^]*<div class="overflow-x-auto"><ol/)
  assert.match(html, /flex shrink-0 items-center gap-2 text-sm/)
  assert.match(html, /data-case-cycle-connector[^>]*mx-3 block h-\[2px\] w-6 shrink-0 sm:w-10 rounded-full bg-qms-primary/)
  assert.ok(html.includes('max-w-[1600px]'))
  assert.ok(html.includes('@min-[1100px]:grid-cols-160px_minmax(0,1fr)_240px') === false)
  // La línea de avance se pinta con el token azul del estado activo.
  assert.match(html, /bg-qms-primary/)
})

test('Quejas y Mis Quejas comparten el espaciado compacto y el largo fijo de conectores', () => {
  const { CaseCycle } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
  const queja = { id: 'q-2', estado: 'En Investigación' }
  const compact = renderToStaticMarkup(createElement(CaseCycle, { queja, audience: 'quality', compact: true, line: true }))
  const investigator = renderToStaticMarkup(createElement(CaseCycle, { queja, audience: 'investigator', compact: true, line: true }))
  assert.match(compact, /<div class="overflow-x-auto"><ol[^>]*class="flex min-w-max items-center gap-0"/)
  assert.match(investigator, /<div class="overflow-x-auto"><ol[^>]*class="flex min-w-max items-center gap-0"/)
  assert.match(investigator, /data-case-cycle-connector[^>]*mx-3 block h-\[2px\] w-6 shrink-0 sm:w-10 rounded-full bg-qms-primary/)
  assert.equal((compact.match(/data-case-cycle-connector/g) || []).length, 2)
  assert.equal((investigator.match(/data-case-cycle-connector/g) || []).length, 2)
})

test('Mis Quejas limita la lectura solo al ampliar y no altera las columnas de Quejas', () => {
  const { CaseWorkspace } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
  const content = createElement('p', null, 'Resolución')
  const props = {
    documentKey: 'q-reading',
    presentation: 'reference',
    documentStyle: 'cards',
    readingLayout: true,
    compact: null,
    cycle: null,
    request: createElement('aside', null, 'Solicitante'),
    action: createElement('aside', null, 'Acción'),
  }
  const expanded = renderToStaticMarkup(createElement(CaseWorkspace, { ...props, expanded: true }, content))
  const collapsed = renderToStaticMarkup(createElement(CaseWorkspace, { ...props, expanded: false }, content))
  const quality = renderToStaticMarkup(createElement(CaseWorkspace, { ...props, readingLayout: false, expanded: true }, content))

  assert.ok(expanded.includes('data-case-reading-layout="true"'))
  assert.ok(expanded.includes('max-w-[1500px]'))
  assert.ok(expanded.includes('@min-[1100px]:grid-cols-[240px_minmax(0,1fr)_270px]'))
  assert.ok(expanded.includes('@min-[1360px]:grid-cols-[280px_minmax(0,1fr)_300px]'))
  assert.ok(expanded.includes('gap-6'))
  assert.ok(expanded.includes('data-case-request-region'))
  assert.ok(expanded.includes('data-case-document'))
  assert.ok(expanded.includes('data-case-action'))
  assert.ok(!collapsed.includes('data-case-reading-layout'))
  assert.ok(!collapsed.includes('max-w-[1500px]'))
  assert.ok(!quality.includes('data-case-reading-layout'))
  assert.ok(!quality.includes('max-w-[1500px]'))
  assert.ok(quality.includes('@min-[1100px]:grid-cols-[220px_minmax(0,1fr)_260px]'))

  const styles = fs.readFileSync('app/styles/components.css', 'utf8')
  assert.ok(styles.includes('[data-case-reading-layout="true"] .mis-quejas-resolution-editor [data-rich-text-viewport] .tiptap'))
  assert.ok(styles.includes('max-width: calc(70ch + 4rem)'))
  assert.ok(styles.includes('[data-case-reading-layout="true"] [data-reading-copy]'))
  assert.ok(styles.includes('max-width: 70ch'))
})

test('modal de notas y adjuntos mantiene 600px de alto con scroll interno y pie fijo', () => {
  const { dialog } = modalFixture({ variant: 'dialog', size: 'lg', fixedHeight: true, footer: 'Acciones' })
  assert.ok(dialog.props.className.includes('h-[min(600px,90dvh)]'))
  const body = dialog.props.children.find(node => node?.props?.className?.includes('flex min-h-0 flex-1'))
  assert.ok(body.props.className.includes('overflow-hidden'))
  const footer = dialog.props.children.find(node => node?.props?.className?.includes('shrink-0 border-t'))
  assert.ok(footer)

  const standard = modalFixture({ variant: 'dialog', size: 'lg' })
  assert.ok(!standard.dialog.props.className.includes('h-[min(600px,90dvh)]'))
})

test('la distribución de Quejas usa lectura concentrada sin comprimir los controles documentales', () => {
  const styles = fs.readFileSync('app/styles/components.css', 'utf8')
  const source = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  assert.ok(source.includes('presentation="reference" cyclePlacement="header" readingLayout'))
  assert.ok(source.includes('data-case-reading-copy'))
  assert.ok(styles.includes('[data-case-reading-layout="true"] [data-case-reading-copy]'))
  assert.ok(styles.includes('max-width: 70ch'))
  assert.ok(!source.includes('data-case-reading-copy><div className="mt-5 border-t'))
})

test('el ciclo expandido de Mis Quejas conserva conectores en barra superior y encabezado compacto', () => {
  const { CaseWorkspace, CaseRequestHeader, CaseCycle } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
  const queja = { id: 'q-3', estado: 'En Investigación', cliente_nombre: 'Persona', email_cliente: 'persona@example.invalid', fecha: '2026-11-05', tipo: 'Afectación' }
  const request = createElement(CaseRequestHeader, { queja, variant: 'panel' })
  const compact = createElement(CaseCycle, { queja, audience: 'investigator', compact: true, line: true })
  const cycle = createElement(CaseCycle, { queja, audience: 'investigator', compact: true, line: true })
  const html = renderToStaticMarkup(createElement(CaseWorkspace, {
    documentKey: 'q-3:detalle', expanded: true, cyclePlacement: 'top', request, compact, cycle,
    action: createElement('aside', null, 'Acción'),
  }, createElement('main', null, 'Descripción')))
  assert.match(html, /data-case-top-cycle/)
  assert.equal((html.match(/data-case-cycle-connector/g) || []).length, 4)
  assert.match(html, /data-case-cycle-track[^]*<div class="overflow-x-auto"><ol[^>]*class="flex min-w-max items-center gap-0"/)
})

test('datos largos de solicitud se envuelven y permanecen dentro del panel lateral', () => {
  const { CaseRequestHeader } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
  const nombre = 'NombreExtenso'.repeat(12)
  const correo = `${'persona'.repeat(12)}@example.invalid`
  const html = renderToStaticMarkup(createElement(CaseRequestHeader, {
    queja: { id: 'q-long', cliente_nombre: nombre, email_cliente: correo, telefono: '60000000', fecha: '2026-11-05', tipo: 'Afectación' },
    variant: 'panel',
  }))
  assert.ok(html.includes(nombre))
  assert.ok(html.includes(correo))
  assert.match(html, /min-w-0 break-words \[overflow-wrap:anywhere\] text-sm font-medium/)
  assert.match(html, /break-all \[overflow-wrap:anywhere\]/)
})

test('etiquetas del panel lateral de acciones se envuelven dentro de la columna', () => {
  const { CaseAction } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
  const html = renderToStaticMarkup(createElement(CaseAction, {
    queja: { id: 'q-review', estado: 'Pendiente de Revisión GC', estado_nombre: 'Pendiente de Revisión GC' },
    runs: [],
    variant: 'plain',
  }))
  assert.equal((html.match(/max-w-full whitespace-normal justify-start text-left/g) || []).length, 1)
  assert.match(html, /data-queja-deadline="true"[^>]*max-w-full/)
  assert.match(html, /min-w-0 break-words">Sin plazo/)
})

test('la revisión documental puede ajustar su alto sin alterar los editores amplios', () => {
  const browser = modalLifecycleHarness()
  const compact = browser.mount({ variant: 'document', height: 'content' })
  assert.doesNotMatch(compact.element.props.className, /(?:^|\s)h-\[90dvh\]/)
  compact.close()
  const editor = browser.mount({ variant: 'document' })
  assert.match(editor.element.props.className, /(?:^|\s)h-\[90dvh\]/)
  editor.close()
})

test('el expediente ampliado no compone un velo sobre un fondo que ya cubre por completo', () => {
  const browser = modalLifecycleHarness()
  const expanded = browser.mount({ variant: 'workspace', expanded: true })
  assert.match(expanded.element.props.className, /backdrop:bg-transparent/)
  assert.doesNotMatch(expanded.element.props.className, /backdrop:bg-black/)
  expanded.close()
  const lateral = browser.mount({ variant: 'workspace' })
  // El 40vw deja ver la tabla operativa: ahí el velo sigue siendo visible.
  assert.match(lateral.element.props.className, /backdrop:bg-black\/50/)
  lateral.close()
})

test('elegir procedencia conserva el mismo documento y vuelve a bloquearlo al reabrir otra visita', () => {
  const panel = complaintPanelFixture()
  panel.select('test-A')
  panel.button('Tomar decisión').props.onClick(); panel.render()
  const first = panel.editor()
  assert.equal(first.props.open, true)
  assert.equal(first.props.variant, 'document')
  assert.equal(first.props.size, 'xl')
  panel.button('Procede').props.onClick(); panel.render()
  assert.equal(panel.editor().props.variant, first.props.variant)
  assert.equal(panel.editor().props.size, first.props.size)
  panel.select(null); panel.select('test-A')
  assert.equal(panel.editor().props.open, false)
})
