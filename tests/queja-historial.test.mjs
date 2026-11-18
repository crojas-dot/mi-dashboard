import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient } from '@tanstack/react-query'
import { loadModule } from './load-module.mjs'

const id = '00000000-0000-4000-8000-000000000101'
const otherId = '00000000-0000-4000-8000-000000000102'
const folio = '2026-101'
const ingreso = '2026-11-12T12:00:00+00:00'
const envio = '2026-11-13T19:00:00+00:00'
const aprobacion = '2026-11-14T19:00:00+00:00'
const transition = estado => `La queja ${folio} cambió a ${estado}.`

function base(tables) {
  return { from(table) {
    let rows = tables[table] ?? []
    const query = {
      select() { return query },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return query },
      gte(key, value) { rows = rows.filter(row => row[key] >= value); return query },
      in(key, values) { rows = rows.filter(row => values.includes(row[key])); return query },
      maybeSingle: async () => ({ data: rows[0] ?? null }),
      then(resolve, reject) { return Promise.resolve({ data: rows }).then(resolve, reject) },
    }
    return query
  } }
}

function fixture({ user, entities = [], includeConflict = false } = {}) {
  const auth = base({
    quejas: entities,
    qms_case_events: [
      { module: 'quejas', case_id: id, kind: 'opened', occurred_at: ingreso },
      { module: 'quejas', case_id: id, kind: 'resolved', occurred_at: aprobacion },
      { module: 'riesgos', case_id: id, kind: 'closed', occurred_at: aprobacion },
    ],
    usuarios: [{ id: 'owner', nombre: 'Persona asignada' }],
  })
  const admin = base({
    notificaciones: [
      { origen_id: id, tipo: 'queja_estado', fecha: envio, mensaje: transition('Pendiente de Revisión GC') },
      { origen_id: id, tipo: 'queja_estado', fecha: envio, mensaje: transition('Pendiente de Revisión GC') },
      { origen_id: otherId, tipo: 'queja_estado', fecha: aprobacion, mensaje: transition('Finalizado') },
    ],
    logs: [
      { modulo: 'quejas', accion: 'transición', fecha: envio, detalle: transition('Pendiente de Revisión GC'), usuario_id: 'owner' },
      ...(includeConflict ? [{ modulo: 'quejas', accion: 'transición', fecha: envio, detalle: transition('Pendiente de Revisión GC'), usuario_id: 'other' }] : []),
      { modulo: 'quejas', accion: 'transición', fecha: aprobacion, detalle: transition('Finalizado'), usuario_id: 'other' },
    ],
    queja_gc_revisiones: [{ queja_id: id, decision: 'approved', created_at: aprobacion, usuario_id: 'quality' }],
  })
  let adminCalls = 0
  const { GET } = loadModule('app/api/quejas/historial/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/server/auth': { getCurrentUser: async () => user, createAuthenticatedClient: () => auth },
    '@/lib/server/supabase-admin': { createServiceClient: () => { adminCalls++; return admin } },
  })
  return { adminCalls: () => adminCalls, call: async (caseId = id) => {
    const nextUrl = new URL(`https://example.test/api/quejas/historial?quejaId=${caseId}`)
    return GET({ nextUrl, signal: AbortSignal.timeout(3000) })
  } }
}

const expediente = { id, folio, fecha: ingreso, responsable_id: 'owner' }
const colaborador = { id: 'owner', rol: 'colaborador' }

test('el historial combina ingreso, envío y revisión de expedientes propios aunque las notas estén vacías', async () => {
  const response = await fixture({ user: colaborador, entities: [expediente] }).call()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  const { movimientos } = await response.json()
  assert.deepEqual(movimientos.map(({ fecha, usuario, accion }) => [fecha, usuario, accion]), [
    [aprobacion, 'Usuario registrado', 'Aprobó la propuesta'],
    [envio, 'Persona asignada', 'Envió la propuesta a Revisión GC'],
    [ingreso, null, 'Registró la queja'],
  ])
  assert.deepEqual(Object.keys(movimientos[0]).sort(), ['accion', 'fecha', 'id', 'usuario'])
})

test('el historial no atribuye una transición cuando sus entradas indican autores distintos', async () => {
  const response = await fixture({ user: colaborador, entities: [expediente], includeConflict: true }).call()
  const { movimientos } = await response.json()
  assert.equal(movimientos.find(row => row.fecha === envio).usuario, null)
})

test('el historial valida sesión, permiso y expediente antes de usar el cliente privilegiado', async () => {
  for (const [args, caseId, status] of [
    [{}, id, 401],
    [{ user: { id: 'owner', rol: 'lector' }, entities: [expediente] }, id, 403],
    [{ user: colaborador }, id, 404],
    [{ user: colaborador, entities: [{ ...expediente, responsable_id: 'other' }] }, id, 404],
    [{ user: colaborador, entities: [expediente] }, 'no-valido', 400],
  ]) {
    const f = fixture(args)
    assert.equal((await f.call(caseId)).status, status)
    assert.equal(f.adminCalls(), 0)
  }
})

test('Historial se prepara solo al abrir el diálogo y comparte la petición y el resultado fresco', async () => {
  const client = new QueryClient()
  let responder
  const pending = new Promise(resolve => { responder = resolve })
  const requests = []
  const { useQuejaHistorial } = loadModule('lib/queries/useQuejaHistorial.ts', {
    react: { useEffect: effect => effect() },
    '@tanstack/react-query': { queryOptions: options => options, useQuery: options => options, useQueryClient: () => client },
    '@/lib/services/apiClient': { apiFetch: async (url, { signal }) => {
      requests.push({ url, signal })
      return pending
    } },
  })
  try {
    const cerrado = { abierto: false, visible: false }
    const notas = { abierto: true, visible: false }
    const historial = { abierto: true, visible: true }
    assert.equal(useQuejaHistorial('', historial).enabled, false)
    assert.equal(useQuejaHistorial(id, cerrado).enabled, false)
    assert.equal(requests.length, 0)
    const prefetch = useQuejaHistorial(id, notas)
    assert.equal(prefetch.enabled, false)
    assert.equal(requests.length, 1)
    const visible = useQuejaHistorial(id, historial)
    assert.deepEqual(Array.from(visible.queryKey), Array.from(prefetch.queryKey))
    const lectura = client.fetchQuery(visible)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, `/api/quejas/historial?quejaId=${id}`)
    assert.ok(requests[0].signal instanceof AbortSignal)
    const movimientos = [{ id: 'registro', usuario: null, fecha: ingreso, accion: 'Registró la queja' }]
    responder(Response.json({ movimientos }))
    assert.deepEqual(await lectura, movimientos)
    useQuejaHistorial(id, cerrado)
    useQuejaHistorial(id, notas)
    assert.deepEqual(await client.fetchQuery(useQuejaHistorial(id, historial)), movimientos)
    assert.equal(requests.length, 1)
  } finally {
    client.clear()
  }
})
