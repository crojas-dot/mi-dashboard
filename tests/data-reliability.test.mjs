import test from 'node:test'
import assert from 'node:assert/strict'
import * as queryCore from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import { loadModule, fakeDatabase } from './load-module.mjs'

const settle = () => new Promise(setImmediate)
const newClient = () => new queryCore.QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } })

// Reloj virtual solo para los hooks: los tests no esperan 750 ms ni abren sockets.
function hookHarness(client) {
  let now = 0
  let nextId = 0
  const timers = new Map()
  const cleanups = []
  return {
    mocks: {
      react: {
        useRef: (current) => ({ current }),
        useCallback: (callback) => callback,
        useEffect: (effect) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup) },
      },
      '@tanstack/react-query': { ...queryCore, useQueryClient: () => client },
    },
    globals: {
      setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, due: now + delay }); return id },
      clearTimeout: (id) => timers.delete(id),
    },
    tick(ms) {
      const target = now + ms
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.due <= target).sort((a, b) => a[1].due - b[1].due)[0]
        if (!next) break
        timers.delete(next[0]); now = next[1].due; next[1].callback()
      }
      now = target
    },
    cleanup() { cleanups.reverse().forEach((cleanup) => cleanup()) },
  }
}

function realtimeHarness(client, config = {}) {
  const harness = hookHarness(client)
  let onEvent
  let onStatus
  let removed = 0
  const channel = {
    on(_type, _filter, callback) { onEvent = callback; return channel },
    subscribe(callback) { onStatus = callback; return channel },
  }
  const { useRealtimeSubscription } = loadModule('hooks/useRealtimeSubscription.ts', {
    ...harness.mocks,
    '@/lib/supabase': { supabase: { channel: () => channel, removeChannel: async () => { removed++ } } },
  }, harness.globals)
  // eslint-disable-next-line react-hooks/rules-of-hooks -- React está sustituido por el harness de efectos, sin dispatcher real.
  useRealtimeSubscription({ table: 'quejas', invalidateKeys: [['quejas'], ['quejas', 'estadisticas'], ['dashboard']], ...config })
  return { ...harness, event: (eventType = 'UPDATE') => onEvent({ eventType }), status: (value) => onStatus(value), get removed() { return removed } }
}

test('Realtime agrupa prefijos solapados y no pospone eventos continuos indefinidamente', async () => {
  const client = newClient()
  const fetches = []
  const observers = [['quejas', { page: 0 }], ['quejas', 'estadisticas'], ['dashboard'], ['documentos']].map((queryKey) => {
    client.setQueryData(queryKey, 'cache')
    const observer = new queryCore.QueryObserver(client, { queryKey, queryFn: async () => { fetches.push(JSON.stringify(queryKey)); return 'nuevo' } })
    return observer.subscribe(() => {})
  })
  const realtime = realtimeHarness(client)
  realtime.status('SUBSCRIBED')
  realtime.event(); realtime.tick(500); realtime.event(); realtime.tick(250)
  await settle()
  assert.deepEqual(fetches.sort(), ['["quejas",{"page":0}]', '["quejas","estadisticas"]', '["dashboard"]'].sort())
  realtime.cleanup(); observers.forEach((unsubscribe) => unsubscribe()); client.clear()
})

test('Realtime conserva cambios al salir antes del lote y no ejecuta refetch al desmontar', async () => {
  const client = newClient()
  client.setQueryData(['quejas'], 'cache')
  let fetches = 0
  const observer = new queryCore.QueryObserver(client, { queryKey: ['quejas'], queryFn: async () => ++fetches })
  const unsubscribe = observer.subscribe(() => {})
  const realtime = realtimeHarness(client)
  realtime.event('DELETE'); realtime.tick(100); realtime.cleanup(); realtime.tick(1000)
  await settle()
  assert.equal(client.getQueryState(['quejas']).isInvalidated, true)
  assert.equal(fetches, 0)
  assert.equal(realtime.removed, 1)
  unsubscribe(); client.clear()
})

test('Realtime resincroniza después de reconectar y respeta la selección de eventos', async () => {
  const client = newClient()
  client.setQueryData(['quejas'], 'cache')
  const realtime = realtimeHarness(client, { events: ['INSERT'] })
  realtime.status('SUBSCRIBED'); realtime.event('UPDATE'); realtime.tick(750)
  assert.equal(client.getQueryState(['quejas']).isInvalidated, false)
  realtime.status('CHANNEL_ERROR'); realtime.status('SUBSCRIBED'); realtime.tick(750)
  assert.equal(client.getQueryState(['quejas']).isInvalidated, true)
  realtime.cleanup(); client.clear()
})

test('hover reutiliza caché fresca y recarga caché invalidada sin duplicar peticiones', async () => {
  const client = newClient()
  const harness = hookHarness(client)
  const { useHoverPrefetch } = loadModule('hooks/useHoverPrefetch.ts', harness.mocks, harness.globals)
  const prefetch = useHoverPrefetch()
  const queryKey = ['documentos']
  let fetches = 0
  const config = { queryKey, queryFn: async () => ++fetches }
  client.setQueryData(queryKey, 0)
  prefetch(config); harness.tick(80); await settle()
  assert.equal(fetches, 0)
  await client.invalidateQueries({ queryKey, refetchType: 'none' })
  prefetch(config); prefetch(config); harness.tick(80); await settle()
  assert.equal(fetches, 1)
  assert.equal(client.getQueryData(queryKey), 1)
  harness.cleanup(); client.clear()
})

test('QueryProvider recupera caché invalidada al volver y conserva consultas frescas', async () => {
  const { default: QueryProvider } = loadModule('lib/providers/QueryProvider.tsx', {
    react: { useState: (initializer) => [initializer()], useEffect: () => {} },
    '@/lib/store/auth-store': { useAuthStore: (selector) => selector({ user: null, vistaActiva: null }) },
  })
  const scoped = QueryProvider({ children: null })
  const client = scoped.type(scoped.props).props.client
  let fetches = 0
  const options = { queryKey: ['dashboard'], queryFn: async () => ++fetches }
  client.setQueryData(options.queryKey, 0)
  let observer = new queryCore.QueryObserver(client, options)
  let unsubscribe = observer.subscribe(() => {})
  await settle()
  assert.equal(fetches, 0)
  unsubscribe()
  await client.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' })
  observer = new queryCore.QueryObserver(client, options)
  unsubscribe = observer.subscribe(() => {})
  await settle()
  assert.equal(fetches, 1)
  unsubscribe(); client.clear()
})

test('Quejas pagina sin repetir filas cuando varias tienen la misma fecha', async () => {
  const db = fakeDatabase({ quejas: ['q4', 'q2', 'q1', 'q3'].map((id) => ({ id, fecha: '2026-09-16' })) })
  const { fetchQuejas } = loadModule('lib/queries/useQuejas.ts', { '@/lib/supabase': db, '@tanstack/react-query': {} })
  const first = await fetchQuejas({ pageSize: 2 })
  const second = await fetchQuejas({ page: 1, pageSize: 2 })
  assert.deepEqual([...first.data, ...second.data].map((row) => row.id), ['q1', 'q2', 'q3', 'q4'])
  assert.equal(first.count, 4)
})

test('Usuarios reutiliza la precarga del menú con filtros vacíos equivalentes', async () => {
  let unexpectedAuth = 0
  const { usuariosQueryKey, useUsuarios } = loadModule('lib/queries/useUsuarios.ts', {
    '@/lib/supabase': { supabase: { auth: { getSession: async () => { unexpectedAuth++; return { data: {} } } } } },
    '@tanstack/react-query': { ...queryCore, useQuery: (options) => options },
  })
  const client = newClient()
  const rows = [{ id: 'u1', nombre: 'Persona de prueba' }]
  await client.prefetchQuery({ queryKey: usuariosQueryKey(), queryFn: async () => rows })
  const observer = new queryCore.QueryObserver(client, useUsuarios({ estado: '', search: '', rol: '' }))
  const unsubscribe = observer.subscribe(() => {})
  await settle()
  assert.equal(unexpectedAuth, 0)
  assert.deepEqual(observer.getCurrentResult().data, rows)
  unsubscribe(); client.clear()
})

function supabaseWithFetch(fetch) {
  return createClient('https://qms.test', 'publishable-test', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } })
}

for (const feature of ['Auditorias', 'Documentos', 'Procesos', 'Reuniones', 'Riesgos', 'SACP']) {
  test(`${feature}: abandonar la página cancela el transporte sin sobrescribir datos en caché`, async () => {
    let requestSignal
    const supabase = supabaseWithFetch((_url, options) => new Promise((_resolve, reject) => {
      requestSignal = options.signal
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const queries = loadModule(`lib/queries/use${feature}.ts`, {
      '@/lib/supabase': { supabase }, '@tanstack/react-query': { ...queryCore, useQuery: (options) => options },
    })
    const client = newClient()
    const options = { ...queries[`use${feature}`](1, 'Activo'), staleTime: 0 }
    const cached = { data: [{ id: 'existente' }], count: 30 }
    client.setQueryData(options.queryKey, cached)
    const observer = new queryCore.QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})
    await settle()
    assert.ok(requestSignal)
    unsubscribe()
    assert.equal(requestSignal.aborted, true)
    assert.deepEqual(client.getQueryData(options.queryKey), cached)
    client.clear()
  })
}

test('Quejas conserva comas, comillas y paréntesis de nombres sin romper filtros de responsable', async () => {
  let requested
  const supabase = supabaseWithFetch(async (url) => {
    requested = new URL(url)
    return new Response('[]', { headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' } })
  })
  const { fetchQuejas } = loadModule('lib/queries/useQuejas.ts', { '@/lib/supabase': { supabase }, '@tanstack/react-query': {} })
  await fetchQuejas({ search: 'ACME, ("Norte")\\Sucursal', responsableId: 'responsable', estado: 'Recibido' })
  assert.equal(requested.searchParams.get('or'), '(folio.ilike."%ACME, (\\"Norte\\")\\\\Sucursal%",cliente_nombre.ilike."%ACME, (\\"Norte\\")\\\\Sucursal%")')
  assert.equal(requested.searchParams.get('responsable_id'), 'eq.responsable')
  assert.equal(requested.searchParams.get('estado'), 'eq.Recibido')
})

test('cancelar una búsqueda de Quejas aborta la petición de red real del cliente Supabase', async () => {
  let requestSignal
  const supabase = supabaseWithFetch((_url, options) => new Promise((_resolve, reject) => {
    requestSignal = options.signal
    requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }))
  const { useQuejas } = loadModule('lib/queries/useQuejas.ts', { '@/lib/supabase': { supabase }, '@tanstack/react-query': { ...queryCore, useQuery: (options) => options } })
  const client = newClient()
  const options = useQuejas({ search: 'texto anterior' })
  const pending = client.fetchQuery(options).catch((error) => error)
  await settle()
  assert.ok(requestSignal)
  await client.cancelQueries({ queryKey: options.queryKey })
  assert.equal(requestSignal.aborted, true)
  assert.equal(queryCore.isCancelledError(await pending), true)
  client.clear()
})

test('cancelar una búsqueda de Usuarios aborta la petición de red real del cliente Supabase', async () => {
  let requestSignal
  const supabase = supabaseWithFetch((_url, options) => new Promise((_resolve, reject) => {
    requestSignal = options.signal
    requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }))
  const { useUsuarios } = loadModule('lib/queries/useUsuarios.ts', { '@/lib/supabase': { supabase }, '@tanstack/react-query': { ...queryCore, useQuery: (options) => options } })
  const client = newClient()
  const options = useUsuarios({ search: 'texto anterior' })
  const pending = client.fetchQuery(options).catch((error) => error)
  await settle()
  assert.ok(requestSignal)
  await client.cancelQueries({ queryKey: options.queryKey })
  assert.equal(requestSignal.aborted, true)
  assert.equal(queryCore.isCancelledError(await pending), true)
  client.clear()
})
