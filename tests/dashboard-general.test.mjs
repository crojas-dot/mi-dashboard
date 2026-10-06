import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, fakeDatabase } from './load-module.mjs'

const { DASHBOARD_MODULES } = loadModule('lib/constants/dashboardModules.ts')

test('General cuenta los siete módulos sin descargar filas ni duplicar Mis Quejas', async () => {
  const db = fakeDatabase({
    quejas: [{ id: 'q1' }, { id: 'q2' }], acciones: [{ id: 's1' }],
    documentos: [{ id: 'd1' }], riesgos: [], auditorias: [{ id: 'a1' }],
    procesos: [{ id: 'p1' }], reuniones: [{ id: 'r1' }],
  })
  const { fetchGeneralTotales } = loadModule('lib/queries/useGeneralTotales.ts', {
    '@/lib/supabase': db, '@tanstack/react-query': {},
  })
  const resultado = await fetchGeneralTotales(DASHBOARD_MODULES)
  assert.deepEqual(Array.from(resultado, (modulo) => [modulo.id, modulo.total]), [
    ['quejas', 2], ['sacp', 1], ['documentos', 1], ['riesgos', 0],
    ['auditorias', 1], ['procesos', 1], ['revision', 1],
  ])
  assert.equal(db.calls.length, 7)
  assert.ok(db.calls.every((call) => call.head && call.columns === 'id'))
})

test('General consulta solo módulos permitidos y no convierte un fallo en cero', async () => {
  const db = fakeDatabase({ quejas: [{ id: 'q1' }] }, { quejas: new Error('Consulta fallida') })
  const { fetchGeneralTotales } = loadModule('lib/queries/useGeneralTotales.ts', {
    '@/lib/supabase': db, '@tanstack/react-query': {},
  })
  await assert.rejects(fetchGeneralTotales(DASHBOARD_MODULES.slice(0, 1)), /Consulta fallida/)
  assert.deepEqual(db.calls.map((call) => call.table), ['quejas'])
})
