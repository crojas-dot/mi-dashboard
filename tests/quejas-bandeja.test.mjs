import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { fakeDatabase, loadModule } from './load-module.mjs'

const loadQueries = (db) => loadModule('lib/queries/useQuejas.ts', {
  '@/lib/supabase': db,
  '@tanstack/react-query': {},
})

test('Quejas ordena por actividad, ingreso e ID antes de paginar', async () => {
  const rows = [
    { id: 'a', fecha: '2026-11-14T12:00:00Z', ultima_actividad_relevante_at: '2026-11-14T12:00:00Z' },
    { id: 'b', fecha: '2026-11-15T12:00:00Z', ultima_actividad_relevante_at: '2026-11-15T12:00:00Z' },
    { id: 'd', fecha: '2026-11-15T12:00:00Z', ultima_actividad_relevante_at: '2026-11-15T12:00:00Z' },
    { id: 'c', fecha: '2026-10-01T12:00:00Z', ultima_actividad_relevante_at: '2026-11-16T12:00:00Z' },
  ]
  const db = fakeDatabase({ qms_quejas_bandeja: rows })
  const { fetchQuejas } = loadQueries(db)
  const first = await fetchQuejas({ pageSize: 2 })
  const next = await fetchQuejas({ pageSize: 2, page: 1 })
  assert.deepEqual(first.data.map(r => r.id), ['c', 'd'])
  assert.deepEqual(next.data.map(r => r.id), ['b', 'a'])
  assert.deepEqual(db.calls[0].orders.map(o => [o.key, o.ascending]), [
    ['ultima_actividad_relevante_at', false], ['fecha', false], ['id', false],
  ])
  assert.equal(db.calls[0].table, 'qms_quejas_bandeja')
  assert.equal(db.calls[0].start, 0)
  assert.equal(db.calls[1].start, 2)
})

test('filtro plazo se aplica en PostgreSQL antes de LIMIT/OFFSET y no afecta aislamiento', async () => {
  const rows = [
    { id: 'a', responsable_id: 'u1', estado: 'Recibido', plazo_filtro: 'vencidos', ultima_actividad_relevante_at: '2026-11-16T12:00:00Z' },
    { id: 'b', responsable_id: 'u1', estado: 'Recibido', plazo_filtro: 'por_vencer', ultima_actividad_relevante_at: '2026-11-16T13:00:00Z' },
    { id: 'c', responsable_id: 'u2', estado: 'Recibido', plazo_filtro: 'vencidos', ultima_actividad_relevante_at: '2026-11-16T14:00:00Z' },
  ]
  const db = fakeDatabase({ qms_quejas_bandeja: rows })
  const { fetchQuejas } = loadQueries(db)
  const result = await fetchQuejas({ pageSize: 1, responsableId: 'u1', estado: 'Recibido', plazo: 'vencidos' })
  assert.deepEqual(result.data.map(row => row.id), ['a'])
  assert.equal(result.count, 1)
})

test('Mis Quejas busca exclusivamente folio y conserva responsable y estado', async () => {
  let requested
  const supabase = createClient('https://qms.test', 'publishable-test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url) => {
      requested = new URL(url)
      return new Response('[]', { headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' } })
    } },
  })
  const { fetchQuejas } = loadQueries({ supabase })
  await fetchQuejas({ search: 'ABC', soloFolio: true, responsableId: 'u1', estado: 'Recibido' })
  assert.match(requested.pathname, /qms_quejas_bandeja$/)
  assert.match(requested.searchParams.get('or'), /folio\.ilike/)
  assert.doesNotMatch(requested.searchParams.get('or'), /cliente_nombre/)
  assert.equal(requested.searchParams.get('responsable_id'), 'eq.u1')
  assert.equal(requested.searchParams.get('estado'), 'eq.Recibido')
})
