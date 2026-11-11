import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const originalDraft = { quejaId: 'a', revision: 17, area: 'Área histórica', numeroOficio: 'ECA-GC-2026-005', observaciones: 'Observación guardada anteriormente.' }
const clone = value => JSON.parse(JSON.stringify(value))
const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children), ...(['AreaAfectadaFrame', 'AreaAfectada'].includes(value.type?.name) ? visit(value.type(value.props)) : [])] : []
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value?.props ? textOf(value.props.children) : typeof value === 'string' ? value : ''

function areaHarness(overrides = {}, catalogOverrides = {}) {
  const slots = [], pending = new Map(), listeners = new Map(), saves = []
  let cursor = 0, tree, cancels = 0, edits = 0, refetches = 0
  const viewport = { innerWidth: 390, innerHeight: 844, addEventListener() {}, removeEventListener() {} }
  const documentBody = {}
  const documentMock = { body: documentBody, activeElement: documentBody, querySelector: () => null,
    addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) } }
  const catalog = { data: [{ valor: 'Innovación y TI' }, { valor: 'SAL' }], isLoading: false, error: null, refetch: () => { refetches++ }, ...catalogOverrides }
  let props = { quejaId: 'a', area: 'Área histórica', draft: originalDraft,
    onEdit: () => edits++, onSave: next => saves.push(next), onCancel: () => cancels++, ...overrides }
  const react = {
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
    useCallback(callback, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((dep, offset) => !Object.is(dep, previous.deps[offset]))) slots[index] = { deps, callback }
      return slots[index].callback
    },
  }
  function effect(callback, deps) {
    const index = cursor++, previous = slots[index]
    if (!previous || deps.some((dep, offset) => !Object.is(dep, previous.deps[offset]))) pending.set(index, { callback, deps })
  }
  react.useEffect = effect; react.useLayoutEffect = effect
  class LocalNode {
    focusCount = 0
    focus() { this.focusCount++; documentMock.activeElement = this }
    contains(other) { return other === this }
    getBoundingClientRect() { return { left: 20, right: 200, top: 30, bottom: 60 } }
    style = {}
    scrollHeight = 230
  }
  const buttonNode = new LocalNode(), popupNode = new LocalNode(), selectedNode = new LocalNode()
  popupNode.contains = other => other === popupNode || other === selectedNode
  popupNode.querySelector = selector => selector === '[aria-pressed="true"]' && visit(tree).some(node => node.props['aria-pressed'] === true) ? selectedNode : null
  const { default: Control } = loadModule('app/quejas/components/AreaQuejaControl.tsx', {
    react,
    '@/lib/queries/useCatalogos': { useCatalogoTipo: () => catalog },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Spinner': { default: 'Spinner' },
  }, { Node: LocalNode, window: viewport, document: documentMock })
  const nodes = () => visit(tree)
  function render(next = {}, nextCatalog = {}) {
    props = { ...props, ...next }; Object.assign(catalog, nextCatalog)
    cursor = 0; tree = Control(props)
    for (const node of nodes()) if (node.props.ref && typeof node.props.ref === 'object') node.props.ref.current = node.type === 'Button' ? buttonNode : popupNode
    for (const [index, { callback, deps }] of pending) { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: callback() } }
    pending.clear()
    return tree
  }
  const option = label => nodes().find(node => node.type === 'Button' && typeof node.props['aria-pressed'] === 'boolean' && textOf(node) === label)
  const trigger = () => nodes().find(node => node.type === 'Button' && node.props.id === `queja-area-${props.quejaId}`)
  const popup = () => nodes().find(node => node.props['data-area-queja-control'] !== undefined)
  render()
  return { render, nodes, option, trigger, popup, saves, listeners, cancels: () => cancels, edits: () => edits, refetches: () => refetches,
    buttonNode, popupNode, selectedNode, LocalNode, viewport, documentMock }
}

test('elegir área guarda directamente el snapshot sin cambiar revisión, oficio ni observación histórica', () => {
  const h = areaHarness()
  h.option('SAL').props.onClick()
  assert.deepEqual(clone(h.saves), [{ ...originalDraft, area: 'SAL' }])
  assert.equal(originalDraft.area, 'Área histórica')
  assert.notStrictEqual(h.saves[0], originalDraft)
  assert.equal(h.cancels(), 0)
})

test('abrir muestra las opciones en un solo paso y conserva el área histórica seleccionada', () => {
  const h = areaHarness({ draft: null })
  assert.equal(h.popup(), undefined)
  h.trigger().props.onClick()
  assert.equal(h.edits(), 1)
  h.render({ draft: { ...originalDraft } })
  assert.equal(h.popup().props['aria-label'], 'Seleccionar área afectada')
  assert.equal(h.option('Área histórica').props['aria-pressed'], true)
  assert.ok(h.option('SAL')); assert.ok(h.option('Innovación y TI'))
  assert.equal(h.selectedNode.focusCount, 1)
  assert.equal(h.saves.length, 0)
})

test('elegir el área actual cierra sin escribir; quitarla conserva los demás datos del snapshot', () => {
  const h = areaHarness()
  h.option('Área histórica').props.onClick()
  assert.equal(h.cancels(), 1); assert.equal(h.saves.length, 0)
  assert.equal(h.buttonNode.focusCount, 1)
  h.option('Sin área asignada').props.onClick()
  assert.deepEqual(clone(h.saves), [{ ...originalDraft, area: '' }])
})

test('cabecera mantiene etiqueta, selección vacía explícita y nombre guardado reconocible', () => {
  const h = areaHarness({ area: '', draft: null })
  assert.ok(h.nodes().some(node => node.type === 'span' && node.props.children === 'Área afectada'))
  assert.ok(h.nodes().some(node => node.type === 'span' && node.props.children === 'Seleccionar área afectada'))
  assert.equal(h.trigger().props['aria-label'], 'Área afectada: Sin indicar')
  assert.equal(h.trigger().props['aria-expanded'], false)
  const area = 'Unidad técnica con nombre institucional muy extenso'
  h.render({ area })
  assert.ok(h.nodes().some(node => node.type === 'span' && node.props.children === area))
  assert.equal(h.trigger().props.title, `Área afectada: ${area}`)
})

test('modo lectura conserva etiqueta y valor sin un selector que permita editar', () => {
  const h = areaHarness({ area: '', draft: null, onEdit: undefined })
  assert.equal(h.trigger(), undefined); assert.equal(h.popup(), undefined)
  assert.ok(h.nodes().some(node => node.type === 'span' && node.props.children === 'Área afectada'))
  assert.ok(h.nodes().some(node => node.type === 'span' && node.props.children === 'Sin indicar'))
  h.render({ area: 'SAL' })
  assert.ok(h.nodes().some(node => node.type === 'span' && node.props.children === 'SAL'))
  assert.equal(h.saves.length, 0)
})

test('Escape cierra solo el selector y devuelve el foco; no lo cancela durante el guardado', () => {
  const h = areaHarness()
  const event = { key: 'Escape', preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true } }
  h.listeners.get('keydown')(event)
  assert.equal(h.cancels(), 1); assert.equal(event.prevented, true); assert.equal(event.stopped, true)
  assert.equal(h.buttonNode.focusCount, 1)
  h.render({ saving: true })
  h.listeners.get('keydown')(event)
  h.listeners.get('pointerdown')({ target: new h.LocalNode() })
  assert.equal(h.cancels(), 1); assert.equal(h.buttonNode.focusCount, 1)
})

test('pulsar fuera cierra sin robar foco, mientras pulsar dentro conserva el selector', () => {
  const h = areaHarness()
  h.listeners.get('pointerdown')({ target: h.selectedNode })
  assert.equal(h.cancels(), 0)
  h.listeners.get('pointerdown')({ target: new h.LocalNode() })
  assert.equal(h.cancels(), 1); assert.equal(h.buttonNode.focusCount, 0)
})

test('un guardado en curso o bloqueo externo impide elegir otra área', () => {
  const h = areaHarness({ saving: true })
  assert.equal(h.trigger().props.disabled, true)
  assert.equal(h.popup().props['aria-busy'], true)
  assert.equal(h.option('SAL').props.disabled, true)
  h.option('SAL').props.onClick()
  assert.equal(h.saves.length, 0)
  h.render({ saving: false, disabled: true })
  h.option('SAL').props.onClick()
  assert.equal(h.option('SAL').props.disabled, true); assert.equal(h.saves.length, 0)
})

test('borrador de otra queja no habilita ni ejecuta una selección', () => {
  const h = areaHarness({ draft: { ...originalDraft, quejaId: 'b' } })
  assert.equal(h.popup(), undefined)
  assert.equal(h.trigger().props['aria-expanded'], false)
  assert.equal(h.saves.length, 0)
})

test('durante carga no ofrece opciones habilitadas y un fallo conserva el valor y permite reintentar', () => {
  const h = areaHarness({}, { isLoading: true })
  assert.ok(h.nodes().some(node => node.props.role === 'status'))
  const choices = h.nodes().filter(node => node.type === 'Button' && typeof node.props['aria-pressed'] === 'boolean')
  assert.ok(choices.length > 0)
  assert.ok(choices.every(node => node.props.disabled))
  h.render({}, { isLoading: false, error: new Error('fixture error') })
  assert.ok(h.nodes().some(node => node.props.role === 'alert'))
  assert.equal(h.option('SAL'), undefined)
  assert.equal(h.trigger().props['aria-label'], 'Área afectada: Área histórica')
  h.nodes().find(node => node.type === 'Button' && node.props.children === 'Reintentar').props.onClick()
  assert.equal(h.refetches(), 1); assert.equal(h.saves.length, 0)
})

test('el popup queda dentro del viewport incluso si el ancla sale por debajo al cambiar altura', () => {
  const h = areaHarness()
  h.viewport.innerWidth = 280; h.viewport.innerHeight = 140
  h.buttonNode.getBoundingClientRect = () => ({ left: 310, right: 490, top: 200, bottom: 230 })
  h.render({ draft: null }); h.render({ draft: { ...originalDraft } })
  const { style } = h.popupNode
  assert.ok(parseFloat(style.left) >= 8)
  assert.ok(parseFloat(style.left) + parseFloat(style.width) <= 272)
  assert.ok(parseFloat(style.top) >= 8)
  assert.ok(parseFloat(style.top) + parseFloat(style.maxHeight) <= 132)
})

test('guardar devuelve foco desde el body sin quitárselo a un documento superior o a otra queja', () => {
  const h = areaHarness()
  h.documentMock.activeElement = h.documentMock.body
  h.render({ draft: null })
  assert.equal(h.buttonNode.focusCount, 1)
  h.render({ draft: { ...originalDraft } })
  h.documentMock.activeElement = h.documentMock.body
  h.documentMock.querySelector = () => ({ contains: () => false })
  h.render({ draft: null })
  assert.equal(h.buttonNode.focusCount, 1)
  h.documentMock.querySelector = () => null
  h.render({ draft: { ...originalDraft } })
  h.documentMock.activeElement = h.documentMock.body
  h.render({ quejaId: 'b', draft: null })
  assert.equal(h.buttonNode.focusCount, 1)
})

test('registro de Mis Quejas oculta campos vacíos y conserva solo valores históricos presentes', () => {
  const { default: Register } = loadModule('components/quejas/RegistroQuejaGC.tsx')
  assert.equal(Register({ queja: { id: 'a', estado: 'Recibido' } }), null)
  const tree = Register({ queja: { id: 'a', estado: 'No Procede', area_afectada: 'SAL', numero_oficio_resolucion: 'ECA-005', observaciones: 'Texto anterior' } })
  const text = JSON.stringify(tree)
  assert.match(text, /Observación anterior/); assert.match(text, /Texto anterior/); assert.match(text, /N.º de oficio explicativo/)
  assert.doesNotMatch(text, /Recepción automática|Tipo recibido|Sin indicar|Sin registrar/)
})
