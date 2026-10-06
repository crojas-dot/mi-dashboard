import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { loadModule } from './load-module.mjs'

function fixture() {
  const effects = []
  const document = { body: {}, activeElement: null, addEventListener() {}, removeEventListener() {} }
  const trigger = { focus() { document.activeElement = trigger } }
  const action = { focus() { document.activeElement = action } }
  const panel = { querySelector: () => action, contains: element => element === action }
  const { default: Popover } = loadModule('components/ui/tailwind/Popover.tsx', {
    react: { ...React, useId: () => 'panel', useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) },
  }, { document })
  const element = Popover({ open: true, onToggle() {}, onClose() {}, label: 'Usuario', trigger: 'Abrir', children: 'Contenido' })
  element.props.children[0].props.ref.current = trigger
  element.props.children[1].props.ref.current = panel
  effects[0]()
  const cleanup = effects[1]()
  element.props.onFocusCapture({ target: action })
  return { element, document, trigger, action, cleanup }
}

test('cerrar el popover para abrir un modal restaura su trigger aun tras eliminar el botón activo', () => {
  const { element, document, trigger, cleanup } = fixture()
  // React quita el nodo antes de la limpieza del efecto; el navegador enfoca body.
  element.props.children[1].props.ref.current = null
  document.activeElement = document.body
  cleanup()
  assert.equal(document.activeElement, trigger, 'el modal siguiente debe poder guardar/restaurar este origen de foco')
})

test('cerrar al salir del popover no roba el foco de otro control', () => {
  const { document, cleanup } = fixture()
  const outside = {}
  document.activeElement = outside
  cleanup()
  assert.equal(document.activeElement, outside)
})
