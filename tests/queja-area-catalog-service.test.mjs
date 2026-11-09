import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const original = { id: 'synthetic-area', valor: 'Área original', activo: true }
const copy = value => JSON.parse(JSON.stringify(value))

function service(result = { data: { id: original.id }, error: null }) {
  const calls = []
  const supabase = { from(table) {
    const call = { table, filters: [], terminalCalls: 0 }
    calls.push(call)
    const query = {
      update(payload) { call.payload = copy(payload); return query },
      eq(field, value) { call.filters.push(['eq', field, value]); return query },
      is(field, value) { call.filters.push(['is', field, value]); return query },
      select(columns) { call.columns = columns; return query },
      async single() { call.terminalCalls++; return result },
    }
    return query
  } }
  return { calls, ...loadModule('lib/services/quejaAreaCatalogService.ts', { '@/lib/supabase': { supabase } }) }
}

test('renombrar solo actualiza valor, recorta espacios y compara el snapshot original completo', async () => {
  const api = service(), area = { ...original, valor: ' Área original ' }
  const change = { valor: '  Nueva área  ' }
  await api.actualizarAreaCatalogo(area, change)
  assert.deepEqual(api.calls, [{ table: 'catalogos', payload: { valor: 'Nueva área' },
    filters: [['eq', 'id', original.id], ['eq', 'modulo', 'quejas'], ['eq', 'tipo', 'area_afectada'], ['eq', 'valor', ' Área original '], ['eq', 'activo', true]],
    columns: 'id', terminalCalls: 1 }])
  assert.equal(area.valor, ' Área original ')
  assert.equal(change.valor, '  Nueva área  ')
})

test('desactivar y reactivar solo escriben activo y conservan nombre e identificadores', async () => {
  for (const activo of [true, false]) {
    const api = service()
    await api.actualizarAreaCatalogo({ ...original, activo }, { activo: !activo })
    assert.deepEqual(api.calls[0].payload, { activo: !activo })
    assert.deepEqual(api.calls[0].filters.at(-1), ['eq', 'activo', activo])
    assert.equal(api.calls[0].terminalCalls, 1)
  }
})

test('el estado histórico null se compara con is null y no se confunde con activo true', async () => {
  const api = service()
  await api.actualizarAreaCatalogo({ ...original, activo: null }, { activo: false })
  assert.deepEqual(api.calls[0].filters.at(-1), ['is', 'activo', null])
  assert.deepEqual(api.calls[0].payload, { activo: false })
})

test('nombres vacíos, longitud mayor de 150 y estados inválidos no escriben', async () => {
  const api = service()
  for (const cambio of [{ valor: '' }, { valor: '  ' }, { valor: 'a'.repeat(151) }, { valor: null }, { valor: 5 }, { activo: null }, { activo: 'true' }, { activo: undefined }]) {
    await assert.rejects(api.actualizarAreaCatalogo(original, cambio))
  }
  assert.equal(api.calls.length, 0)
  await api.actualizarAreaCatalogo(original, { valor: 'a'.repeat(150) })
  assert.equal(api.calls.length, 1)
})

test('rechaza cambios ambiguos, sin campos o campos ajenos antes de consultar', async () => {
  const api = service()
  for (const cambio of [{}, { valor: 'Nueva', activo: true }, { valor: 'Nueva', orden: 0 }, { orden: 2 }, null, undefined]) {
    await assert.rejects(api.actualizarAreaCatalogo(original, cambio), /una operación/)
  }
  assert.equal(api.calls.length, 0)
})

test('un snapshot incompleto no puede escribir usando filtros indefinidos', async () => {
  const api = service()
  for (const area of [null, { ...original, id: '' }, { ...original, valor: null }, { ...original, activo: undefined }]) {
    await assert.rejects(api.actualizarAreaCatalogo(area, { activo: false }), /Actualizá el catálogo/)
  }
  assert.equal(api.calls.length, 0)
})

test('cero filas se informa como conflicto sin releer ni repetir el update', async () => {
  const api = service({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
  await assert.rejects(api.actualizarAreaCatalogo(original, { valor: 'Nueva' }), /cambió o ya no está disponible/)
  assert.equal(api.calls.length, 1)
  assert.equal(api.calls[0].terminalCalls, 1)
})

test('RLS, unicidad y errores de transporte se propagan sin anunciar éxito ni reintentar', async () => {
  for (const error of [{ code: '42501', message: 'Not authorized' }, { code: '23505', message: 'Duplicate area' }, new Error('Synthetic network failure')]) {
    const api = service({ data: null, error })
    await assert.rejects(api.actualizarAreaCatalogo(original, { valor: 'Nueva' }), actual => actual === error)
    assert.equal(api.calls.length, 1)
    assert.equal(api.calls[0].terminalCalls, 1)
  }
})

test('sin confirmación de la fila solicitada no se considera guardado', async () => {
  for (const data of [null, {}, { id: 'another-area' }]) {
    const api = service({ data, error: null })
    await assert.rejects(api.actualizarAreaCatalogo(original, { activo: false }), /Actualizá el catálogo/)
    assert.equal(api.calls.length, 1)
  }
})
