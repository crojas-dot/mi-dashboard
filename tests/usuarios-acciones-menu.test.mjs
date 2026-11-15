import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

function harness({ estado = 'activo', esPropio = false, top = 100, bottom = 136, right = 900 } = {}) {
  const slots = [], callbacks = []
  let cursor = 0, tree
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect() {},
  }
  const usuario = { id: 'usuario-fixture', nombre: 'Persona de prueba', estado }
  const win = { innerHeight: 500, innerWidth: 1024, addEventListener() {}, removeEventListener() {} }
  const doc = { body: {} }
  const { default: Menu } = loadModule('app/usuarios/components/UsuarioAccionesMenu.tsx', {
    react, 'react-dom': { createPortal: node => node },
  }, { window: win, document: doc })
  const visit = node => Array.isArray(node) ? node.flatMap(visit) : node?.props ? [node, ...visit(node.props.children)] : []
  const text = node => Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : typeof node === 'string' ? node : ''
  const render = () => { cursor = 0; tree = Menu({ usuario, esPropio,
    onEditar: () => callbacks.push('editar'),
    onRestablecer: () => callbacks.push('resetear'),
    onEstado: () => callbacks.push('estado') }); return tree }
  const trigger = () => visit(tree).find(node => node.type === 'button' && node.props['data-users-action-trigger'])
  const menu = () => visit(tree).find(node => node.props?.role === 'menu')
  const actions = () => visit(tree).filter(node => node.props?.role === 'menuitem')
  const open = () => {
    slots[2].current = { getBoundingClientRect: () => ({ top, bottom, right }) }
    trigger().props.onClick()
    render()
  }
  render()
  return { render, trigger, menu, actions, open, callbacks, text }
}

test('las tres acciones comparten el mismo menú y cierran al elegir una opción', () => {
  for (const [index, expected, label] of [
    [0, 'editar', 'Actualizar perfil'],
    [1, 'resetear', 'Restablecer contraseña'],
    [2, 'estado', 'Desactivar cuenta'],
  ]) {
    const ui = harness()
    assert.equal(ui.trigger().props['aria-expanded'], false)
    ui.open()
    assert.equal(ui.trigger().props['aria-expanded'], true)
    assert.equal(ui.menu().props['data-users-actions-menu'], true)
    assert.equal(ui.actions().length, 3)
    assert.match(ui.text(ui.actions()[index]), new RegExp(label))
    ui.actions()[index].props.onClick()
    ui.render()
    assert.equal(ui.menu(), undefined)
    assert.deepEqual(ui.callbacks, [expected])
  }
})

test('el botón Editar visible despliega las tres acciones sin ejecutar edición directamente', () => {
  const ui = harness()
  assert.match(ui.text(ui.trigger()), /Editar/)
  assert.match(ui.trigger().props.className, /bg-qms-primary-soft/)
  assert.match(ui.trigger().props.className, /select-none/)
  assert.match(ui.trigger().props['aria-label'], /Editar y más acciones de Persona de prueba/)
  assert.equal(ui.trigger().props['aria-haspopup'], 'menu')
  ui.open()
  assert.deepEqual(ui.callbacks, [], 'abrir el menú no debe editar al usuario')
  assert.equal(ui.actions().length, 3)
})

test('la cuenta propia impide desactivar; las cuentas inactivas pueden restaurarse', () => {
  const propio = harness({ esPropio: true })
  propio.open()
  assert.equal(propio.actions()[2].props.disabled, true)
  assert.equal(propio.callbacks.length, 0)
  const inactivo = harness({ estado: 'inactivo' })
  inactivo.open()
  assert.equal(inactivo.actions()[2].props.disabled, false)
  assert.match(inactivo.text(inactivo.actions()[2]), /Restaurar cuenta/)
  inactivo.actions()[2].props.onClick()
  inactivo.render()
  assert.deepEqual(inactivo.callbacks, ['estado'])
})

test('el menú se posiciona por encima cuando se abre al final de la tabla', () => {
  const ui = harness({ top: 455, bottom: 491, right: 1000 })
  ui.open()
  assert.equal(ui.menu().props.style.position, 'fixed')
  assert.ok(ui.menu().props.style.top < 455)
  assert.ok(ui.menu().props.style.left >= 8)
  assert.ok(ui.menu().props.style.left <= 1024 - 224 - 8)
})
