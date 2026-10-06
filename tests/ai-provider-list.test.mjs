import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const provider = { id: 'demo', nombre: 'Proveedor de muestra', tipo: 'openai', api_key: 'CLAVE_QUE_NO_DEBE_APARECER', base_url: 'https://privado.example.test/v1', modelos: ['modelo-1'], tokens_usados: 10, limite_tokens: 100 }
function props(overrides = {}) {
  return { providers: [provider], syncingModels: new Set(), testProviderId: null, testInProgress: false, testProgress: {}, onTest() {}, onSync() {}, onEdit() {}, onDelete() {}, onConnect() {}, onReset() {}, ...overrides }
}
function module(selected = null) {
  return loadModule('components/configuracion/AIProviderList.tsx', { react: { ...React, useState: () => [selected, () => {}] } }).default
}
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !node.props) return []
  return [node, ...elements(node.props.children)]
}
function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return node?.props ? textOf(node.props.children) : ''
}

test('el listado resume 0, 1 y 50 modelos y no renderiza URL ni credenciales', () => {
  const List = module()
  const providers = [0, 1, 50].map(count => ({ ...provider, id: String(count), modelos: Array.from({ length: count }, (_, i) => `modelo-largo-${i}`) }))
  const html = renderToStaticMarkup(React.createElement(List, props({ providers })))
  assert.match(html, /0 modelos/)
  assert.match(html, /1 modelo/)
  assert.match(html, /50 modelos/)
  assert.doesNotMatch(html, /CLAVE_QUE_NO_DEBE_APARECER|privado\.example|API Key|URL Base/)
  assert.doesNotMatch(html, /modelo-largo-49/)
})

test('las seis acciones conservan el proveedor y la edición recibe el objeto original', () => {
  const calls = []
  const callbacks = Object.fromEntries(['Test', 'Sync', 'Edit', 'Delete', 'Connect', 'Reset'].map(action => [`on${action}`, value => calls.push([action, value])]))
  const nodes = elements(module()(props(callbacks)))
  for (const label of ['Testear', 'Sincronizar', 'Editar', 'Conexión', 'Reiniciar']) {
    nodes.find(node => node.props.onClick && textOf(node).trim() === label).props.onClick()
  }
  nodes.find(node => node.props['aria-label'] === `Eliminar ${provider.nombre}`).props.onClick()
  assert.deepEqual(calls.map(([action]) => action), ['Test', 'Sync', 'Edit', 'Connect', 'Reset', 'Delete'])
  for (const [action, value] of calls) assert.equal(value, action === 'Edit' ? provider : provider.id)
})

test('se mantienen los bloqueos de test y sincronización mientras el proveedor está ocupado', () => {
  const buttons = options => elements(module()(props(options))).filter(node => node.props.onClick)
  const find = (nodes, label) => nodes.find(node => textOf(node).trim() === label)
  assert.equal(find(buttons({ syncingModels: new Set([provider.id]) }), 'Testear').props.disabled, true)
  assert.equal(find(buttons({ syncingModels: new Set([provider.id]) }), 'Sincronizar').props.disabled, true)
  assert.equal(find(buttons({ providers: [{ ...provider, modelos: [] }] }), 'Testear').props.disabled, true)
  assert.equal(find(buttons({ testInProgress: true, testProviderId: provider.id }), 'Sincronizar').props.disabled, true)
})

test('la consulta de modelos conserva la lista completa, incluidos los nombres largos', () => {
  const modelos = Array.from({ length: 50 }, (_, i) => `organizacion/modelo-completo-${i}`)
  const List = module(provider.id)
  const html = renderToStaticMarkup(React.createElement(List, props({ providers: [{ ...provider, modelos }] })))
  assert.equal((html.match(/<li /g) ?? []).length, 50)
  assert.match(html, /organizacion\/modelo-completo-49/)
})
