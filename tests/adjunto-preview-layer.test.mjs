import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { loadModule } from './load-module.mjs'

const fixtureAttachment = (id, mime = 'application/pdf') => ({ id, nombre: 'Documento.pdf', storage_path: id, tamano: 1, tipo_mime: mime })
const legacyAttachment = id => ({ ...fixtureAttachment(id), storage_path: 'fixture/' + id + '.pdf' })
const flush = () => new Promise(resolve => setImmediate(resolve))
function nodes(element) {
  if (!element || typeof element !== 'object') return []
  if (Array.isArray(element)) return element.flatMap(nodes)
  return [element, ...nodes(element.props?.children)]
}
function urls(element) { return nodes(element).flatMap(node => [node.props?.url, node.props?.src].filter(Boolean)) }
function text(element) {
  if (typeof element === 'string') return element
  if (Array.isArray(element)) return element.map(text).join('')
  return element && typeof element === 'object' ? text(element.props?.children) : ''
}

function previewHarness(options = {}) {
  let slots = [], cursor = 0, mountedKey = null, pending = [], visits = 0
  const requests = [], downloads = []
  const react = {
    ...React,
    useId: () => { cursor++; return 'preview-fixture' },
    useState: initial => {
      const index = cursor++; if (!(index in slots)) slots[index] = initial
      const activeSlots = slots
      return [slots[index], next => { activeSlots[index] = typeof next === 'function' ? next(activeSlots[index]) : next }]
    },
    useRef: initial => { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
    useEffect: (effect, deps) => {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) pending.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
    },
  }
  const Preview = loadModule('components/quejas/AdjuntoPreviewModal.tsx', {
    react,
    '@/lib/supabase': { supabase: { storage: { from: bucket => ({ createSignedUrl: (path, ttl) => new Promise((resolve, reject) => requests.push({ bucket, path, ttl, resolve, reject })) }) } } },
    '@/lib/services/quejaWorkflowService': { descargarAdjuntoQueja: adjunto => new Promise(resolve => downloads.push({ adjunto, resolve })) },
    '@/lib/services/errorToast': { showError() {} },
    // El visor Drive directo no debe esperar una descarga autorizada completa.
    '@/lib/services/driveClient': { fetchDriveBlob() { throw new Error('El visor Drive no descarga un blob') } },
  }, options.globals).default
  function unmount() {
    for (const slot of slots) slot?.cleanup?.()
    slots = []; pending = []; mountedKey = null
  }
  return {
    requests, downloads, get visits() { return visits }, unmount,
    render(adjunto, onClose = () => {}) {
      const mounted = Preview({ adjunto, onClose })
      if (!mounted) { unmount(); return null }
      if (mounted.key !== mountedKey) { unmount(); mountedKey = mounted.key; visits++ }
      cursor = 0
      const result = mounted.type(mounted.props)
      options.beforeEffects?.(result)
      for (const apply of pending.splice(0)) apply()
      return result
    },
  }
}

test('el visor usa la capa modal nativa, no vuelve a mostrar un dialog abierto y Escape conserva foco', () => {
  let closes = 0, stopped = false, shown = 0
  const document = { body: {}, activeElement: null }
  class Element { isConnected = true; focus() { document.activeElement = this } }
  const origin = new Element(); document.activeElement = origin
  const dialog = { open: false, showModal() { this.open = true; shown++ }, close() { this.open = false; document.activeElement = document.body } }
  const h = previewHarness({ globals: { document, HTMLElement: Element }, beforeEffects: element => { element.props.ref.current = dialog } })
  const element = h.render(fixtureAttachment('fixture-native'), () => closes++)
  assert.equal(element.type, 'dialog'); assert.equal(shown, 1)
  h.render({ ...fixtureAttachment('fixture-native') }); assert.equal(shown, 1)
  element.props.onCancel({ preventDefault() {}, stopPropagation() { stopped = true } })
  assert.equal(closes, 1); assert.equal(stopped, true)
  h.unmount(); assert.equal(document.activeElement, origin); assert.equal(dialog.open, false)
})

test('Drive abre inmediatamente su visor para PDF, imagen y Office sin requests ni skeleton intermedios', () => {
  for (const mime of ['application/pdf', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '']) {
    const h = previewHarness(), file = fixtureAttachment('fixture-direct-drive', mime), element = h.render(file)
    const frame = nodes(element).find(node => node.type === 'iframe')
    assert.equal(frame.props.src, 'https://drive.google.com/file/d/fixture-direct-drive/preview')
    assert.equal(frame.props.className, 'h-full w-full border-0 bg-qms-hover-bg')
    assert.equal(frame.props.onLoad, undefined)
    assert.equal(frame.props.hidden, undefined)
    assert.equal(frame.key, file.storage_path)
    assert.equal(h.requests.length, 0)
    assert.equal(nodes(element).some(node => node.props?.label === 'Preparando vista previa…'), false)
    h.unmount()
  }
})

test('anticipar Vista previa solo prepara el origen Drive y nunca solicita bytes ni abre el documento', () => {
  for (const layout of ['cards', 'list']) {
    const connections = [], previews = [], downloads = [], requests = []
    const ListaAdjuntos = loadModule('components/quejas/ListaAdjuntos.tsx', {
      'react-dom': { preconnect: (...args) => connections.push(args) },
    }, { fetch: (...args) => { requests.push(args); throw new Error('No se deben solicitar bytes al anticipar una vista previa') } }).default
    const file = fixtureAttachment('fixture-drive-intent')
    const element = ListaAdjuntos({ adjuntos: [file], layout, onPreview: value => previews.push(value), onDownload: value => downloads.push(value) })
    const previewControls = nodes(element).filter(node => node.props?.title === 'Vista previa' || node.props?.['aria-label'] === `Vista previa de ${file.nombre}`)
    assert.equal(previewControls.length, 2)
    assert.equal(connections.length, 0)
    for (const control of previewControls) {
      control.props.onPointerEnter()
      control.props.onFocus()
      control.props.onPointerDown()
    }
    assert.equal(connections.length, 6)
    for (const args of connections) assert.equal(JSON.stringify(args), JSON.stringify(['https://drive.google.com']))
    assert.equal(requests.length, 0)
    assert.equal(previews.length, 0)
    assert.equal(downloads.length, 0)
    previewControls[0].props.onClick()
    assert.equal(previews.length, 1)
    assert.equal(previews[0], file)
  }
})

test('la intención sobre archivos Storage históricos no abre conexiones a Google', () => {
  for (const layout of ['cards', 'list']) {
    const connections = []
    const ListaAdjuntos = loadModule('components/quejas/ListaAdjuntos.tsx', {
      'react-dom': { preconnect: (...args) => connections.push(args) },
    }).default
    const file = legacyAttachment('fixture-storage-intent')
    const element = ListaAdjuntos({ adjuntos: [file], layout, onPreview() {}, onDownload() {} })
    const previewControls = nodes(element).filter(node => node.props?.title === 'Vista previa' || node.props?.['aria-label'] === `Vista previa de ${file.nombre}`)
    assert.equal(previewControls.length, 2)
    for (const control of previewControls) {
      control.props.onPointerEnter()
      control.props.onFocus()
      control.props.onPointerDown()
    }
    assert.equal(connections.length, 0)
  }
})

test('clics sobre la misma evidencia mantienen la visita y src; cerrar y abrir comienza otra visita', () => {
  const h = previewHarness(), file = fixtureAttachment('fixture-stable')
  const first = h.render(file), copied = h.render({ ...file })
  assert.deepEqual(urls(copied), urls(first)); assert.equal(h.visits, 1); assert.equal(h.requests.length, 0)
  assert.equal(h.render(null), null)
  const reopened = h.render(file)
  assert.deepEqual(urls(reopened), urls(first)); assert.equal(h.visits, 2)
  const switched = h.render(fixtureAttachment('fixture-next'))
  assert.deepEqual(urls(switched), ['https://drive.google.com/file/d/fixture-next/preview']); assert.equal(h.visits, 3)
  h.unmount()
})

test('la respuesta legacy de una visita cerrada nunca aparece al reabrir el mismo archivo', async () => {
  const h = previewHarness(), file = legacyAttachment('fixture-reopen')
  h.render(file); h.render(null); h.render(file)
  assert.equal(h.requests.length, 2)
  h.requests[0].resolve({ data: { signedUrl: 'https://storage.example.test/old' } }); await flush()
  assert.deepEqual(urls(h.render(file)), [])
  h.requests[1].resolve({ data: { signedUrl: 'https://storage.example.test/current' } }); await flush()
  assert.deepEqual(urls(h.render(file)), ['https://storage.example.test/current'])
  h.render(null); assert.deepEqual(urls(h.render(file)), [])
  h.unmount()
})

test('cambiar evidencia legacy descarta URL/error anteriores y no repite requests por copias de metadata', async () => {
  const h = previewHarness(), first = legacyAttachment('fixture-one'), second = legacyAttachment('fixture-two')
  h.render(first); h.render({ ...first }); assert.equal(h.requests.length, 1)
  h.render(second)
  h.requests[0].reject(new Error('Late fixture failure')); await flush()
  const loading = h.render(second)
  assert.equal(nodes(loading).some(node => node.props?.role === 'alert'), false)
  h.requests[1].resolve({ data: { signedUrl: 'https://storage.example.test/two' } }); await flush()
  assert.deepEqual(urls(h.render(second)), ['https://storage.example.test/two'])
  h.render(first); assert.deepEqual(urls(h.render(first)), []); assert.equal(h.requests.length, 3)
  h.unmount()
})

test('un fallo legacy permite un único reintento explícito y conserva el marco durante la carga', async () => {
  const h = previewHarness(), file = legacyAttachment('fixture-retry')
  const loading = h.render(file)
  h.requests[0].resolve({ error: { message: 'Fixture denied' } }); await flush()
  const failed = h.render(file)
  assert.equal(h.requests.length, 1)
  const retry = nodes(failed).find(node => node.type === 'button' && text(node) === 'Reintentar vista previa')
  assert.ok(retry); retry.props.onClick()
  const retried = h.render(file); assert.equal(h.requests.length, 2)
  assert.equal(nodes(retried).some(node => node.props?.role === 'alert'), false)
  h.requests[1].resolve({ data: { signedUrl: 'https://storage.example.test/retry' } }); await flush()
  const loaded = h.render(file)
  assert.deepEqual(urls(loaded), ['https://storage.example.test/retry'])
  assert.equal(loaded.props.className, loading.props.className)
  assert.match(loading.props.className, /h-\[min\(92dvh,56rem\)\]/)
  assert.match(loading.props.className, /max-h-\[calc\(100dvh-2rem\)\]/)
  h.unmount()
})

test('dos clics sin esperar al render no ejecutan descargas concurrentes', async () => {
  const h = previewHarness(), file = fixtureAttachment('fixture-download'), element = h.render(file)
  const button = nodes(element).find(node => node.type === 'button' && node.props.title === 'Descargar')
  const first = button.props.onClick(), second = button.props.onClick()
  assert.equal(h.downloads.length, 1)
  assert.equal(h.render(file).props.children[0].props.children.find(node => node?.props?.title === 'Descargar').props.disabled, true)
  h.downloads[0].resolve(); await Promise.all([first, second])
  assert.equal(nodes(h.render(file)).find(node => node.type === 'button' && node.props.title === 'Descargar').props.disabled, false)
  h.unmount()
})
