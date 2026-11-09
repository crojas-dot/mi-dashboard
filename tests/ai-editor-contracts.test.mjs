import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'
const { cambiarRutaIA } = loadModule('components/configuracion/ia/routing.ts')
const { modelosDelEditor } = loadModule('components/configuracion/ia/configuracion.ts')
const clone = value => JSON.parse(JSON.stringify(value))
const providers = [{ id: 'uno', modelos: ['Modelo-A'] }, { id: 'varios', modelos: ['Modelo-B', 'Modelo-C'] }]

test('editar respaldo copia su ruta sin mutar otro módulo ni el borrador previo', () => {
  const untouched = Object.freeze({ proveedor_id: 'uno', modelo_nombre: 'Modelo-A' })
  const ruta = Object.freeze({ proveedor_id: 'varios', modelo_nombre: 'Modelo-B', system_prompt: 'Contexto' })
  const previous = Object.freeze({ quejas: ruta, sacp: untouched })
  const next = cambiarRutaIA(previous, 'quejas', 'fallback_provider_id', 'uno', providers)
  assert.equal(next.sacp, untouched)
  assert.notEqual(next.quejas, ruta)
  assert.equal(next.quejas.fallback_modelo, 'Modelo-A')
  assert.equal(previous.quejas.fallback_provider_id, undefined)
  assert.equal(next.quejas.system_prompt, 'Contexto')
})

test('selección única se completa; múltiples o proveedor eliminado limpian modelo anterior', () => {
  const previous = { quejas: { proveedor_id: 'uno', modelo_nombre: 'Modelo-A' } }
  for (const campo of ['proveedor_id', 'fallback_provider_id']) {
    const modelo = campo === 'proveedor_id' ? 'modelo_nombre' : 'fallback_modelo'
    assert.equal(cambiarRutaIA(previous, 'quejas', campo, 'uno', providers).quejas[modelo], 'Modelo-A')
    assert.equal(cambiarRutaIA(previous, 'quejas', campo, 'varios', providers).quejas[modelo], '')
    assert.equal(cambiarRutaIA(previous, 'quejas', campo, '', providers).quejas[modelo], '')
  }
})

test('respaldo de ruta nueva conserva los campos requeridos del transporte', () => {
  const next = cambiarRutaIA({}, 'general', 'fallback_provider_id', 'uno', providers)
  assert.deepEqual(clone(next.general), { proveedor_id: '', modelo_nombre: '', fallback_provider_id: 'uno', fallback_modelo: 'Modelo-A' })
})

test('modelos conservan orden/case y no repiten IDs de fila o progreso', () => {
  for (const value of [[' Modelo-A ', '', 'Modelo-B', 'Modelo-A'], ' Modelo-A, ,Modelo-B, Modelo-A'])
    assert.deepEqual(Array.from(modelosDelEditor(value)), ['Modelo-A', 'Modelo-B'])
})
