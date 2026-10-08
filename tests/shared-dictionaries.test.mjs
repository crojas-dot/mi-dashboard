import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const palette = loadModule('lib/constants/badges.ts')
const states = loadModule('lib/constants/estados.ts')
const complaints = loadModule('lib/constants/quejas.ts')
const { calcularNivelRiesgo } = loadModule('lib/utils/riesgos.ts')

function catalogService() {
  const writes = []
  const supabase = { from(table) {
    const query = {
      insert(payload) { writes.push({ table, method: 'insert', payload }); return query },
      update(payload) { writes.push({ table, method: 'update', payload }); return query },
      eq(field, value) { writes.at(-1).filter = [field, value]; return query },
      select() { return query },
      async single() { return { data: { id: 'synthetic' }, error: null } },
    }
    return query
  } }
  return { writes, ...loadModule('lib/services/configuracionService.ts', { '@/lib/supabase': { supabase } }) }
}
const draft = { modulo: 'quejas', tipo: 'categoria', valor: '  Valor sintético  ', orden: 2 }

test('catálogo persiste sus seis códigos semánticos sin transformarlos en colores de UI', async () => {
  const api = catalogService()
  assert.deepEqual(Array.from(palette.COLORES_CATALOGO, color => color.value), ['primary', 'info', 'success', 'warning', 'danger', 'secondary'])
  for (const { value } of palette.COLORES_CATALOGO) await api.guardarValorCatalogo({ ...draft, color: value })
  assert.deepEqual(api.writes.map(write => write.payload.color), ['primary', 'info', 'success', 'warning', 'danger', 'secondary'])
  assert.ok(api.writes.every(write => write.payload.valor === 'Valor sintético'))
})

test('el valor nuevo sin color usa secondary y editar conserva ID y código', async () => {
  const api = catalogService()
  await api.guardarValorCatalogo(draft)
  await api.guardarValorCatalogo({ ...draft, id: 'existing-synthetic', color: 'warning', activo: false })
  assert.equal(api.writes[0].payload.color, 'secondary')
  assert.equal(api.writes[1].method, 'update')
  assert.deepEqual(api.writes[1].filter, ['id', 'existing-synthetic'])
  assert.equal(api.writes[1].payload.activo, false)
})

test('rechaza colores visuales, hex y claves de prototipo antes de escribir', async () => {
  const api = catalogService()
  for (const color of ['gray', 'blue', '#F57C00', 'constructor', '__proto__', '']) {
    await assert.rejects(api.guardarValorCatalogo({ ...draft, color }), /color válido/)
    assert.equal(palette.esColorCatalogo(color), false)
  }
  assert.equal(api.writes.length, 0)
})

test('badge traduce códigos DB por la misma paleta y trata claves desconocidas como gris', () => {
  for (const { value, variante } of palette.COLORES_CATALOGO) assert.equal(palette.estiloBadge(value), palette.estiloBadge(variante))
  for (const value of ['constructor', '__proto__', '#abc', 'nuevo-estado']) assert.equal(palette.estiloBadge(value), palette.estiloBadge('gray'))
})

test('un estado nuevo o desconocido no confunde módulos ni cambia la resolución por su color', () => {
  assert.equal(states.varianteEstado('quejas', 'En Investigación'), 'investigacion')
  assert.equal(states.varianteEstado('sacp', 'En Proceso'), 'blue')
  assert.equal(states.varianteEstado('quejas', 'En Proceso'), 'gray')
  assert.equal(states.varianteEstado('revision', 'constructor'), 'gray')
  assert.equal(complaints.esQuejaResuelta('Resuelto'), true)
  for (const value of ['En Investigación', 'Finalizado', 'Cerrada', 'No Procede', 'success', 'green']) assert.equal(complaints.esQuejaResuelta(value), false)
})

test('matriz y formulario de riesgos conservan los límites de la fórmula compartida', () => {
  assert.equal(calcularNivelRiesgo(1, 1), 'Bajo')
  assert.equal(calcularNivelRiesgo(1, 2), 'Bajo')
  assert.equal(calcularNivelRiesgo(2, 2), 'Medio')
  assert.equal(calcularNivelRiesgo(2, 3), 'Alto')
  assert.equal(calcularNivelRiesgo(3, 3), 'Critico')
})
