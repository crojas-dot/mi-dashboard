import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Editor, Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { loadModule } from './load-module.mjs'

import { plainTextDocument, richTextFormat } from '../lib/utils/richText.ts'
import { richTextExtensions } from '../lib/utils/richTextExtensions.ts'
const { default: RichTextContent } = loadModule('components/ui/RichTextContent.tsx')
const clone = value => JSON.parse(JSON.stringify(value))
const paragraphText = document => document.content.map(node => (node.content ?? []).map(child => child.text ?? '').join('')).join('\n')
const createEditor = (value, format = 'plain') => new Editor({
  element: null, extensions: richTextExtensions(),
  content: format === 'plain' ? plainTextDocument(value) : value,
  ...(format === 'markdown' ? { contentType: 'markdown' } : {}),
})

test('un texto histórico conserva asteriscos, HTML, líneas vacías y caracteres especiales literalmente', () => {
  const original = '**literal** <script>alert(1)</script> & _texto_\n\n1. sin lista\nEspañol ñ á 😀'
  assert.equal(paragraphText(plainTextDocument(original)), original)
  assert.equal(richTextFormat(undefined), 'plain')
  assert.equal(richTextFormat('html'), 'plain')
  assert.equal(richTextFormat('markdown'), 'markdown')
  const editor = createEditor(original)
  assert.equal(paragraphText(editor.getJSON()), original)
  assert.equal(editor.getJSON().content[0].content[0].marks, undefined)
  editor.destroy()
})

test('Tiptap real serializa y reabre el subconjunto visual sin perder negrita, cursiva, títulos o listas', () => {
  const document = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Resolución' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Criterio ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'técnico', marks: [{ type: 'italic' }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Una acción' }] }] }] },
    { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Otro paso' }] }] }] },
  ] }
  const editor = new Editor({ element: null, extensions: richTextExtensions(), content: document })
  const markdown = editor.getMarkdown()
  const restored = createEditor(markdown, 'markdown')
  assert.equal(restored.getMarkdown(), markdown)
  assert.equal(restored.getJSON().content[0].type, 'heading')
  assert.equal(restored.getJSON().content[1].content[0].marks[0].type, 'bold')
  assert.equal(restored.getJSON().content[1].content.find(node => node.text === 'técnico').marks[0].type, 'italic')
  assert.equal(restored.getJSON().content[2].type, 'bulletList')
  assert.equal(restored.getJSON().content[3].type, 'orderedList')
  editor.destroy(); restored.destroy()
})

test('migrar mediante edición protege Markdown/HTML literal al serializar y reabrir', () => {
  const original = '**sin formato**\n<iframe src="https://example.invalid">literal</iframe>\n[texto](javascript:alert(1))'
  const editor = createEditor(original)
  const restored = createEditor(editor.getMarkdown(), 'markdown')
  assert.equal(paragraphText(restored.getJSON()), original)
  assert.equal(restored.getJSON().content[0].content[0].marks, undefined)
  assert.equal(restored.getJSON().content[2].content[0].marks, undefined)
  editor.destroy(); restored.destroy()
})

test('el esquema del editor no admite enlaces, imágenes, iframes ni adjuntos', () => {
  const editor = createEditor('Documento')
  for (const name of ['image', 'iframe', 'video', 'file', 'codeBlock']) assert.equal(editor.schema.nodes[name], undefined)
  for (const name of ['link', 'underline', 'strike', 'code']) assert.equal(editor.schema.marks[name], undefined)
  editor.destroy()
})

test('el lector muestra plain literalmente y Markdown únicamente cuando el formato es explícito', () => {
  const source = '**literal** <img src="https://example.invalid/track">'
  const plain = renderToStaticMarkup(React.createElement(RichTextContent, { value: source }))
  assert.match(plain, /\*\*literal\*\*/)
  assert.match(plain, /&lt;img/)
  assert.doesNotMatch(plain, /<img|<strong>/)
  const markdown = renderToStaticMarkup(React.createElement(RichTextContent, { value: '**Real**', format: 'markdown' }))
  assert.match(markdown, /<strong>Real<\/strong>/)
})

test('el lector seguro no ejecuta HTML ni carga imágenes o enlaces a sitios externos', () => {
  const markdown = '**Texto**\n\n<script>alert(1)</script>\n\n![rastreo](https://example.invalid/t.png)\n\n[enlace](javascript:alert(1))\n\n<iframe src="https://example.invalid"></iframe>'
  const html = renderToStaticMarkup(React.createElement(RichTextContent, { value: markdown, format: 'markdown' }))
  assert.match(html, /<strong>Texto<\/strong>/)
  assert.doesNotMatch(html, /<(script|iframe|img|a)\b|javascript:|src=/)
})

function editorHarness({ reactiveState = { empty: true }, snapshotEditor, paginationDocument } = {}) {
  const slots = [], effects = [], paginationRefreshes = []
  let cursor = 0, currentOptions, update, editable, supplied
  const editor = {
    storage: { markdown: { manager: { serialize: value => value.serialized ?? '' } } },
    setEditable: (...args) => { editable = args },
    commands: {
      setContent: (...args) => { supplied = args },
      updatePageGap: gap => { paginationRefreshes.push(gap) },
    },
    getMarkdown: () => update ?? '**literal**',
    ...(snapshotEditor ? {
      isActive: (...args) => snapshotEditor.isActive(...args),
      can: () => snapshotEditor.can(),
    } : {}),
  }
  // El getter no debe congelarse al crear el doble: cambia con el documento real.
  if (snapshotEditor) Object.defineProperty(editor, 'isEmpty', { get: () => snapshotEditor.isEmpty })
  const react = {
    ...React,
    useRef(value) { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index] },
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], value => { slots[index] = value }] },
    useMemo(create) { const index = cursor++; if (!(index in slots)) slots[index] = create(); return slots[index] },
    useLayoutEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous[i])) { slots[index] = deps; effects.push(effect) }
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous[i])) { slots[index] = deps; effects.push(effect) }
    },
  }
  const Body = loadModule('components/ui/RichTextEditorBody.tsx', {
    react,
    '@tiptap/core': { Extension }, '@tiptap/pm/state': { Plugin }, '@/lib/utils/richTextExtensions': { richTextExtensions },
    'tiptap-pagination-plus': {
      PAGE_SIZES: { A4: { pageHeight: 1123, pageWidth: 794, marginTop: 95, marginBottom: 95, marginLeft: 76, marginRight: 76 } },
      PaginationPlus: { configure: options => ({ name: 'PaginationPlus', options }) },
    },
    '@tiptap/react': { useEditor(options) { currentOptions = options; return editor }, useEditorState: () => reactiveState, EditorContent: 'EditorContent' },
  }, paginationDocument ? { document: paginationDocument } : {}).default
  const changes = []
  return {
    editor, changes, paginationRefreshes,
    render(props = {}) { cursor = 0; const tree = Body({ id: 'fixture-editor', label: 'Observaciones', value: '**literal**', onChange: (...args) => changes.push(args), ...props }); effects.splice(0).forEach(apply => apply()); return tree },
    change(value) { update = value; currentOptions.onUpdate({ editor }) },
    get options() { return currentOptions }, get supplied() { return supplied }, get editable() { return editable },
  }
}

test('el placeholder existe al abrir y habilitar un editor vacío antes de la primera transacción', () => {
  const actual = createEditor('')
  const h = editorHarness({ reactiveState: null, snapshotEditor: actual })
  const placeholder = 'Escribí la justificación'
  function hasPlaceholder(tree) {
    if (!tree || typeof tree !== 'object') return false
    if (Array.isArray(tree)) return tree.some(hasPlaceholder)
    return tree.props?.children === placeholder || hasPlaceholder(tree.props?.children)
  }
  try {
    assert.equal(actual.isEmpty, true)
    assert.equal(hasPlaceholder(h.render({ value: '', placeholder, disabled: true, variant: 'document', layout: 'fill' })), true)
    assert.equal(hasPlaceholder(h.render({ value: '', placeholder, disabled: false, variant: 'document', layout: 'fill' })), true)
    assert.deepEqual(h.changes, [], 'mostrar la guía no agrega texto ni marca dirty')
    actual.commands.setContent(plainTextDocument('Una justificación escrita'), { emitUpdate: false })
    assert.equal(hasPlaceholder(h.render({ value: 'Una justificación escrita', placeholder, variant: 'document', layout: 'fill' })), false)
  } finally { actual.destroy() }
})

test('el editor React no marca dirty ni convierte el formato al montar o sincronizar props', () => {
  const h = editorHarness()
  h.render()
  assert.deepEqual(h.changes, [])
  assert.equal(h.options.immediatelyRender, false)
  assert.equal(h.options.shouldRerenderOnTransaction, false)
  assert.equal(h.supplied, undefined)
  h.render({ value: 'Recarga externa', disabled: true })
  assert.deepEqual(h.changes, [])
  assert.deepEqual(clone(h.supplied[0]), clone(plainTextDocument('Recarga externa')))
  assert.equal(h.supplied[1].emitUpdate, false)
  assert.deepEqual(h.editable, [false, false])
  h.change('**Edición**')
  assert.deepEqual(h.changes, [['**Edición**', 'markdown']])
  h.render({ value: '**Edición**', format: 'markdown' })
  h.change('**Edición**')
  assert.equal(h.changes.length, 1)
})

test('el editor informa su Markdown serializado al terminar la inicialización sin emitir un cambio', () => {
  const initialized = []
  const h = editorHarness()
  h.render({ value: '**literal**', format: 'markdown', onInitialized: value => initialized.push(value) })
  h.options.onCreate({ editor: h.editor })
  assert.deepEqual(initialized, ['**literal**'])
  assert.deepEqual(h.changes, [])
})

test('las ediciones usan el callback del último render confirmado sin emitir cambios al sincronizar', () => {
  const h = editorHarness(), first = [], second = []
  h.render({ onChange: (...args) => first.push(args) })
  h.change('Primera edición')
  h.render({ value: 'Primera edición', format: 'markdown', onChange: (...args) => second.push(args) })
  assert.deepEqual(first, [['Primera edición', 'markdown']])
  assert.deepEqual(second, [])
  h.change('Nueva edición')
  assert.deepEqual(second, [['Nueva edición', 'markdown']])
  assert.equal(first.length, 1)
})

test('la paginación se limita al informe y limpia el estilo global al cerrar el último editor paginado', () => {
  const styles = Array.from({ length: 3 }, () => ({ remove() { styles.splice(styles.indexOf(this), 1) } }))
  const paginationDocument = { head: { querySelectorAll: () => styles } }
  const regular = editorHarness()
  regular.render()
  assert.equal(regular.options.extensions.some(extension => extension.name === 'PaginationPlus'), false)

  const report = editorHarness({ paginationDocument })
  report.render({ pagination: true })
  const [pagination, lifecycle] = report.options.extensions.slice(-2)
  assert.equal(pagination.name, 'PaginationPlus')
  assert.deepEqual(JSON.parse(JSON.stringify(pagination.options)), {
    pageHeight: 1123, pageWidth: 794, marginTop: 76, marginBottom: 76, marginLeft: 76, marginRight: 76,
    pageGap: 16, pageGapBorderSize: 1, pageGapBorderColor: 'var(--color-qms-border)',
    pageBreakBackground: 'var(--color-qms-hover-bg)', contentMarginTop: 0, contentMarginBottom: 0,
    footerRight: 'Página {page}',
  })
  assert.equal(lifecycle.name, 'qmsPaginationStyleLifecycle')
  lifecycle.config.onCreate()
  assert.equal(styles.length, 1, 'elimina estilos duplicados heredados del paquete')
  lifecycle.config.onDestroy()
  assert.equal(styles.length, 0, 'retira el estilo global al desmontar el último editor')
})

test('las hojas paginadas tienen fondo gris, páginas A4 delimitadas y foco sin contorno azul', () => {
  const styles = readFileSync(new URL('../app/styles/components.css', import.meta.url), 'utf8')
  assert.match(styles, /\.queja-informe-editor \.tiptap\.rm-with-pagination\s*\{[^}]*background:\s*var\(--color-qms-hover-bg\)/s)
  assert.match(styles, /\.queja-informe-editor \.tiptap\.rm-with-pagination \.rm-page-header::before\s*\{[^}]*height:\s*var\(--rm-page-height\)/s)
  assert.match(styles, /\.queja-informe-editor \.tiptap\.rm-with-pagination \.rm-page-header::before\s*\{[^}]*width:\s*var\(--rm-page-width\)/s)
  assert.match(styles, /\.queja-informe-editor \.tiptap\.rm-with-pagination \.rm-page-header::before\s*\{[^}]*border:\s*1px solid var\(--color-qms-border\)/s)
  assert.match(styles, /\.tiptap\.rm-with-pagination:focus-visible\s*\{[^}]*outline:\s*none/s)
})

test('una edición del informe pide recalcular los marcadores de página', () => {
  const h = editorHarness()
  h.render({ pagination: true })
  h.change('## Informe\n\nTexto actualizado')
  assert.deepEqual(h.paginationRefreshes, [16])

  const regular = editorHarness()
  regular.render()
  regular.change('Texto actualizado')
  assert.deepEqual(regular.paginationRefreshes, [])
})

test('la barra y el viewport tienen anclajes separados para mantener fija la barra en documentos largos', () => {
  const h = editorHarness()
  const tree = h.render({ variant: 'document', layout: 'fill' })
  const nodes = []
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (value?.props) { nodes.push(value); visit(value.props.children) }
  }
  visit(tree)
  const toolbar = nodes.find(node => node.props['data-rich-text-toolbar'] !== undefined)
  const viewport = nodes.find(node => node.props['data-rich-text-viewport'] !== undefined)
  assert.equal(toolbar.props.role, 'group')
  assert.equal(toolbar.props['aria-label'], 'Formato de Observaciones')
  assert.match(viewport.props.className, /flex-1 overflow-y-auto/)
  assert.doesNotMatch(toolbar.props.className, /overflow-y-auto/)
  assert.deepEqual(nodes.map(node => node.props['aria-label']).filter(Boolean), [
    'Formato de Observaciones', 'Estilo de texto', 'Negrita', 'Cursiva',
    'Lista con viñetas', 'Lista numerada', 'Cita', 'Separador',
    'Quitar formato', 'Deshacer', 'Rehacer',
  ])
})

test('el filtro de pegado impide superar el límite pero permite reducir un documento histórico largo', () => {
  const h = editorHarness()
  h.render({ maxLength: 20 })
  const extension = h.options.extensions.at(-1)
  const plugin = extension.config.addProseMirrorPlugins.call({ editor: h.editor })[0]
  const transaction = value => ({ docChanged: true, getMeta: () => false, doc: { toJSON: () => ({ serialized: value }) } })
  const state = value => ({ doc: { toJSON: () => ({ serialized: value }) } })
  assert.equal(plugin.spec.filterTransaction(transaction('a'.repeat(21)), state('a')), false)
  assert.equal(plugin.spec.filterTransaction({ ...transaction('a'.repeat(40)), getMeta: () => true }, state('a')), true, 'restaurar props no trunca un documento histórico')
  assert.equal(plugin.spec.filterTransaction(transaction('a'.repeat(20)), state('a')), true)
  assert.equal(plugin.spec.filterTransaction(transaction('a'.repeat(25)), state('a'.repeat(30))), true)
  assert.equal(plugin.spec.filterTransaction({ docChanged: false }, state('a')), true)
})
