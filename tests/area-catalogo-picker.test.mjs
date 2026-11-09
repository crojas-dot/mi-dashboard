import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
const text = value => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
const first = { id: 'area-a', modulo: 'quejas', tipo: 'area_afectada', valor: 'Área A', activo: true, color: 'secondary', orden: 0 }
const second = { ...first, id: 'area-b', valor: 'Área B', orden: 1 }
const removed = { ...first, id: 'area-c', valor: 'Área C', activo: false, orden: 2 }
const initialRows = [first, second, removed].map(row => ({ row, valor: row.valor }))

function fixture(overrides = {}) {
  const slots = [], effects = new Map(), listeners = new Map(), domNodes = new Map()
  const changes = [], edits = [], removes = [], restores = [], focuses = []
  let cursor = 0, changed = false, tree, popupButtons = []
  const props = { id: 'areas-test', rows: clone(initialRows), value: 'area-a', disabled: false, loading: false, canManage: true,
    onChange: value => changes.push(value), onEdit: row => edits.push(row), onRemove: row => removes.push(row), onRestore: row => restores.push(row), ...overrides }
  const documentMock = { activeElement: null,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) } }
  const viewport = { innerWidth: 390, innerHeight: 844, addEventListener() {}, removeEventListener() {} }
  class LocalNode {
    constructor(key) { this.key = key; this.style = {}; this.dataset = {}; this.scrollHeight = 230; this.scrollTop = 0; this.popover = false; this.showCount = 0; this.hideCount = 0 }
    focus() { documentMock.activeElement = this; focuses.push(this.key) }
    contains(node) { return node === this }
    getBoundingClientRect() { return { left: 20, right: 300, top: 30, bottom: 70, width: 280 } }
    setAttribute(name, value) { this[name] = value }
    showPopover() { this.popover = true; this.showCount++ }
    hidePopover() { this.popover = false; this.hideCount++ }
    matches(selector) { return selector === ':popover-open' && this.popover }
  }
  const triggerNode = new LocalNode('trigger'), popupNode = new LocalNode('popup'), menuNode = new LocalNode('menu')
  popupNode.contains = node => node === popupNode || popupButtons.includes(node)
  const matches = (node, selector) => selector === '[aria-pressed="true"]' ? node.props['aria-pressed'] === true
    : selector === '[data-catalog-choice]' ? node.props['data-catalog-choice'] !== undefined
      : selector === '[data-catalog-actions]' ? node.props['data-catalog-actions'] !== undefined
        : selector === '[role="menuitem"]' ? node.props.role === 'menuitem'
          : selector === 'button:not(:disabled)' ? !node.props.disabled : false
  popupNode.querySelectorAll = selector => popupButtons.filter(node => selector.split(',').some(part => matches(node, part.trim())))
  popupNode.querySelector = selector => selector === '[role="menu"]' ? nodes().some(node => node.props.role === 'menu') ? menuNode : null : popupNode.querySelectorAll(selector)[0] ?? null
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; changed = true } }]
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
    useCallback(callback, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) slots[index] = { deps, callback }
      return slots[index].callback
    },
  }
  function effect(callback, deps) {
    const index = cursor++, previous = slots[index]
    if (!previous || deps.length !== previous.deps.length || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) effects.set(index, { deps, callback })
  }
  react.useEffect = effect; react.useLayoutEffect = effect
  const { default: Picker } = loadModule('app/quejas/components/AreaCatalogoPicker.tsx', {
    react, '@/components/ui/Button': { default: 'Button' },
  }, { document: documentMock, window: viewport, Node: LocalNode })
  const nodes = () => visit(tree)
  const trigger = () => nodes().find(node => node.type === 'Button' && node.props.id === props.id)
  const popup = () => nodes().find(node => node.props.role === 'dialog')
  const action = id => nodes().find(node => node.props['data-catalog-actions'] === id)
  const choice = key => nodes().find(node => node.props['data-catalog-choice'] !== undefined && text(node).startsWith(key))
  const item = label => nodes().find(node => node.props.role === 'menuitem' && text(node) === label)
  function domFor(node) {
    const key = node.props['data-catalog-actions'] ? `action:${node.props['data-catalog-actions']}` : node.props.role === 'menuitem' ? `menu:${text(node)}` : `choice:${text(node)}`
    if (!domNodes.has(key)) domNodes.set(key, new LocalNode(key))
    const dom = domNodes.get(key)
    dom.props = node.props; dom.dataset = { catalogActions: node.props['data-catalog-actions'] }
    return dom
  }
  function render(next = {}) {
    Object.assign(props, next)
    let cycles = 0
    do {
      assert.ok(cycles++ < 25, 'El render se estabiliza')
      changed = false; cursor = 0; tree = Picker(props)
      for (const node of nodes()) if (node.props.ref && typeof node.props.ref === 'object') node.props.ref.current = node.type === 'Button' ? triggerNode : popupNode
      popupButtons = visit(popup()?.props.children).filter(node => node.type === 'Button').map(domFor)
      for (const [index, { deps, callback }] of effects) { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: callback() } }
      effects.clear()
    } while (changed)
    return tree
  }
  const event = key => ({ key, prevented: false, stopped: false, preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true } })
  const open = () => { trigger().props.onClick(); render() }
  const menu = id => { action(id).props.onClick(); render() }
  const escape = () => { const input = event('Escape'); listeners.get('keydown')?.(input); render(); return input }
  const navigate = key => { const input = event(key); popup().props.onKeyDown(input); render(); return input }
  render()
  return { render, nodes, trigger, popup, action, choice, item, open, menu, escape, navigate, event,
    changes, edits, removes, restores, focuses, documentMock, listeners, triggerNode, popupNode, menuNode, domNodes, viewport, LocalNode,
    dispose() { for (const slot of slots) slot?.cleanup?.() } }
}

test('elegir una fila solo cambia la selección local y cierra sin editar ni eliminar', () => {
  const h = fixture()
  h.open(); h.choice('Área B').props.onClick(); h.render()
  assert.deepEqual(h.changes, ['area-b'])
  assert.equal(h.edits.length + h.removes.length + h.restores.length, 0)
  assert.equal(h.popup(), undefined)
  assert.equal(h.documentMock.activeElement, h.triggerNode)
})

test('abrir enfoca la opción seleccionada aunque no sea la primera fila', () => {
  const h = fixture({ value: 'area-b' })
  h.open()
  assert.equal(h.documentMock.activeElement.key, 'choice:Área B')
  assert.equal(h.changes.length, 0)
  assert.equal(h.trigger().props['aria-expanded'], true)
})

test('los tres puntos no seleccionan y Editar usa el snapshot de esa fila tras un refresco', () => {
  const h = fixture({ value: 'area-a' })
  h.open(); h.menu('area-b')
  assert.equal(h.changes.length, 0)
  const newer = clone(initialRows).map(item => item.row.id === 'area-b' ? { row: { ...item.row, valor: 'Nombre nuevo', activo: false }, valor: 'Nombre nuevo' } : item)
  h.render({ rows: newer, value: 'area-c' })
  h.item('Editar').props.onClick(); h.render()
  assert.deepEqual(clone(h.edits), [second])
  assert.notStrictEqual(h.edits[0], second)
  assert.equal(h.popup(), undefined)
  assert.equal(h.removes.length + h.restores.length + h.changes.length, 0)
})

test('Eliminar y Restaurar identifican su propia fila sin usar la selección vigente', () => {
  const h = fixture({ value: 'area-b' })
  h.open(); h.menu('area-a'); h.item('Eliminar').props.onClick(); h.render()
  assert.deepEqual(clone(h.removes), [first]); assert.equal(h.changes.length, 0)
  h.open(); h.menu('area-c')
  assert.equal(h.item('Eliminar'), undefined)
  h.item('Restaurar').props.onClick(); h.render()
  assert.deepEqual(clone(h.restores), [removed]); assert.equal(h.changes.length, 0)
})

test('sin administración no se ofrecen tres puntos ni acciones de mutación', () => {
  const h = fixture({ canManage: false })
  h.open()
  assert.equal(h.action('area-a'), undefined)
  assert.equal(h.nodes().some(node => node.props.role === 'menuitem'), false)
  h.choice('Área B').props.onClick(); h.render()
  assert.deepEqual(h.changes, ['area-b'])
  assert.equal(h.edits.length + h.removes.length + h.restores.length, 0)
})

test('retirar administración con un menú abierto oculta las acciones y no puede mutar', () => {
  const h = fixture()
  h.open(); h.menu('area-a'); h.render({ canManage: false })
  assert.equal(h.nodes().some(node => node.props.role === 'menuitem'), false)
  assert.equal(h.edits.length + h.removes.length + h.restores.length, 0)
})

test('Escape primero cierra el menú y devuelve foco a sus tres puntos; el siguiente cierra el selector', () => {
  const h = fixture()
  h.open(); h.menu('area-b')
  assert.equal(h.documentMock.activeElement.key, 'menu:Editar')
  const firstEscape = h.escape()
  assert.equal(firstEscape.prevented, true); assert.equal(firstEscape.stopped, true)
  assert.ok(h.popup()); assert.equal(h.item('Editar'), undefined)
  assert.equal(h.documentMock.activeElement.key, 'action:area-b')
  const secondEscape = h.escape()
  assert.equal(secondEscape.prevented, true); assert.equal(secondEscape.stopped, true)
  assert.equal(h.popup(), undefined)
  assert.equal(h.documentMock.activeElement, h.triggerNode)
})

test('un bloqueo cierra selector y menú y las acciones no reviven al desbloquear', () => {
  const h = fixture()
  h.open(); h.menu('area-a'); h.render({ disabled: true })
  assert.equal(h.trigger().props.disabled, true)
  assert.equal(h.trigger().props['aria-expanded'], false)
  assert.equal(h.popup(), undefined)
  h.render({ disabled: false }); h.open()
  assert.equal(h.item('Editar'), undefined)
  assert.equal(h.edits.length + h.removes.length + h.restores.length, 0)
})

test('clic dentro conserva el selector y clic fuera lo cierra sin robar foco', () => {
  const h = fixture()
  h.open()
  h.listeners.get('pointerdown')({ target: h.popupNode }); h.render()
  assert.ok(h.popup())
  const outside = new h.LocalNode('outside')
  outside.focus()
  h.listeners.get('pointerdown')({ target: outside }); h.render()
  assert.equal(h.popup(), undefined); assert.equal(h.documentMock.activeElement, outside)
})

test('Tab hacia otro control cierra el selector sin devolver foco al disparador', () => {
  const h = fixture()
  h.open()
  const outside = new h.LocalNode('outside'); outside.focus()
  h.popup().props.onBlur({ currentTarget: h.popupNode, relatedTarget: outside }); h.render()
  assert.equal(h.popup(), undefined)
  assert.equal(h.documentMock.activeElement, outside)
})

test('Tab entre acciones conserva el menú y pasar a otra fila cierra solo ese menú', () => {
  const h = fixture()
  h.open(); h.menu('area-a')
  h.menuNode.contains = node => node === h.menuNode || node.key?.startsWith('menu:')
  const inside = h.domNodes.get('menu:Eliminar')
  inside.focus()
  h.nodes().find(node => node.props.role === 'menu').props.onBlur({ currentTarget: h.menuNode, relatedTarget: inside }); h.render()
  assert.ok(h.item('Editar')); assert.ok(h.item('Eliminar'))
  const nextRow = h.domNodes.get('choice:Área B')
  nextRow.focus()
  h.nodes().find(node => node.props.role === 'menu').props.onBlur({ currentTarget: h.menuNode, relatedTarget: nextRow })
  h.popup().props.onBlur({ currentTarget: h.popupNode, relatedTarget: nextRow }); h.render()
  assert.equal(h.item('Editar'), undefined)
  assert.ok(h.popup()); assert.equal(h.trigger().props['aria-expanded'], true)
  assert.equal(h.documentMock.activeElement, nextRow)
  assert.equal(h.changes.length + h.edits.length + h.removes.length + h.restores.length, 0)
})

test('teclado abre con Flecha abajo y recorre opciones y menú con Inicio/Fin/flechas', () => {
  const h = fixture()
  const input = h.event('ArrowDown')
  h.trigger().props.onKeyDown(input); h.render()
  assert.equal(input.prevented, true); assert.ok(h.popup())
  h.navigate('End'); assert.equal(h.documentMock.activeElement.key, 'action:area-c')
  h.navigate('Home'); assert.equal(h.documentMock.activeElement.key, 'choice:Área A')
  h.navigate('ArrowDown'); assert.equal(h.documentMock.activeElement.key, 'action:area-a')
  h.navigate('ArrowUp'); assert.equal(h.documentMock.activeElement.key, 'choice:Área A')
  h.menu('area-a')
  h.navigate('End'); assert.equal(h.documentMock.activeElement.key, 'menu:Eliminar')
  h.navigate('ArrowDown'); assert.equal(h.documentMock.activeElement.key, 'menu:Editar')
})

test('el popup usa top layer y se ajusta al viewport aunque el ancla quede fuera', () => {
  const h = fixture()
  h.viewport.innerWidth = 280; h.viewport.innerHeight = 140
  h.triggerNode.getBoundingClientRect = () => ({ left: 310, right: 590, width: 280, top: 200, bottom: 240 })
  h.open()
  const { style } = h.popupNode
  assert.equal(h.popupNode.popover, true)
  assert.ok(parseFloat(style.left) >= 8)
  assert.ok(parseFloat(style.left) + parseFloat(style.width) <= 272)
  assert.ok(parseFloat(style.top) >= 8)
  assert.ok(parseFloat(style.top) + parseFloat(style.maxHeight) <= 132)
  h.dispose()
  assert.equal(h.popupNode.popover, false)
  assert.equal(h.listeners.size, 0)
})

test('el menú de una fila al final se desplaza dentro del popup y mantiene sus acciones visibles', () => {
  const h = fixture()
  h.open()
  h.popupNode.getBoundingClientRect = () => ({ top: 30, bottom: 130 })
  h.menuNode.getBoundingClientRect = () => ({ top: 180 - h.popupNode.scrollTop, bottom: 250 - h.popupNode.scrollTop })
  h.menu('area-c')
  assert.ok(h.popupNode.scrollTop > 0)
  assert.ok(h.menuNode.getBoundingClientRect().bottom <= h.popupNode.getBoundingClientRect().bottom)
  assert.equal(h.documentMock.activeElement.key, 'menu:Editar')
})

test('Fin revela el control enfocado sin desplazar el documento exterior', () => {
  const h = fixture()
  h.open()
  h.popupNode.getBoundingClientRect = () => ({ top: 30, bottom: 130 })
  const lastAction = h.domNodes.get('action:area-c')
  lastAction.getBoundingClientRect = () => ({ top: 200 - h.popupNode.scrollTop, bottom: 240 - h.popupNode.scrollTop })
  h.navigate('End')
  assert.equal(h.documentMock.activeElement, lastAction)
  assert.ok(lastAction.getBoundingClientRect().bottom <= h.popupNode.getBoundingClientRect().bottom)
})

test('abrir una selección fuera de la ventana visible la revela dentro de la lista', () => {
  const h = fixture({ value: 'area-b' })
  h.popupNode.getBoundingClientRect = () => ({ top: 30, bottom: 130 })
  const selectedNode = new h.LocalNode('choice:Área B')
  selectedNode.getBoundingClientRect = () => ({ top: 180 - h.popupNode.scrollTop, bottom: 220 - h.popupNode.scrollTop })
  h.domNodes.set(selectedNode.key, selectedNode)
  h.open()
  assert.equal(h.documentMock.activeElement, selectedNode)
  assert.ok(selectedNode.getBoundingClientRect().bottom <= h.popupNode.getBoundingClientRect().bottom)
})
