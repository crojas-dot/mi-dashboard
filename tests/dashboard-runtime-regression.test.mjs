import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { QueryClient, QueriesObserver } from '@tanstack/query-core'
import { loadModule } from './load-module.mjs'

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))
const rows = {
  quejas: [{ id: 'q1', folio: 'Q-1', cliente_nombre: 'Caso', estado: 'En Investigación', fecha_sla: '2026-10-10' }],
  acciones: [{ id: 'a1', folio: 'SACP-1', tipo: 'Correctiva', estado: 'Abierta', fecha_limite: '2026-10-08' }],
}

function prepararDashboard(intercept) {
  const requests = []
  const supabase = createClient('https://qms.test', 'publishable-test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      const table = new URL(url).pathname.split('/').at(-1)
      requests.push({ table, signal: options.signal })
      // Se ejecuta con el SDK real y el QueryFunctionContext real de TanStack.
      assert.equal(typeof options.signal?.addEventListener, 'function')
      assert.equal(typeof options.signal?.removeEventListener, 'function')
      const intercepted = await intercept?.(table, requests.length)
      if (intercepted) return intercepted
      return new Response(options.method === 'HEAD' ? null : JSON.stringify(rows[table] ?? []), {
        headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
      })
    } },
  })
  const queryLists = []
  const api = loadModule('lib/queries/useDashboard.ts', {
    '@/lib/supabase': { supabase },
    '@tanstack/react-query': { useQueries: ({ queries }) => {
      queryLists.push(queries)
      return queries.map(() => ({ isPending: true, error: null }))
    } },
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return { requests, api, client, queryLists }
}

test('precarga y bloques comparten cuatro peticiones con AbortSignal válido y reutilizan la caché', async () => {
  const h = prepararDashboard()
  const cleanups = []
  try {
    // El error original ocurría al ejecutar una queryFn desde prefetchQuery.
    await Promise.all(h.api.dashboardPrefetchOptions().map((options) => h.client.prefetchQuery(options)))
    assert.equal(h.requests.length, 4)
    h.api.useDashboardIndicadores(); h.api.useDashboardTareas()
    for (const queries of h.queryLists) {
      const observer = new QueriesObserver(h.client, queries)
      cleanups.push(observer.subscribe(() => {}))
      assert.ok(observer.getCurrentResult().every((result) => result.data))
    }
    await settle()
    assert.equal(h.requests.length, 4, 'montar los dos bloques no debe volver a consultar tablas precargadas')
    await h.client.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'none' })
    await Promise.all(h.api.dashboardPrefetchOptions().map((options) => h.client.fetchQuery(options)))
    assert.equal(h.requests.length, 8, 'la revalidación consulta cada tabla una sola vez')
  } finally { cleanups.forEach((cleanup) => cleanup()); h.client.clear() }
})

test('montar los dos bloques sin precarga tampoco duplica Quejas ni SACP', async () => {
  const h = prepararDashboard()
  const cleanups = []
  try {
    h.api.useDashboardIndicadores(); h.api.useDashboardTareas()
    const observers = h.queryLists.map((queries) => new QueriesObserver(h.client, queries))
    for (const observer of observers) cleanups.push(observer.subscribe(() => {}))
    await Promise.all(h.api.dashboardPrefetchOptions().map((options) => h.client.fetchQuery(options)))
    assert.equal(h.requests.length, 4)
    assert.equal(h.requests.filter((request) => request.table === 'quejas').length, 1)
    assert.equal(h.requests.filter((request) => request.table === 'acciones').length, 1)
    const tareas = observers[1].getCurrentResult().flatMap((result) => result.data.tareas)
    assert.equal(tareas.length, 2)
  } finally { cleanups.forEach((cleanup) => cleanup()); h.client.clear() }
})

test('las tareas terminan mientras Documentos sigue cargando', async () => {
  let completeDocuments
  const documents = new Promise((resolve) => { completeDocuments = resolve })
  const h = prepararDashboard((table) => table === 'documentos' ? documents : undefined)
  const cleanups = []
  try {
    h.api.useDashboardIndicadores(); h.api.useDashboardTareas()
    const observers = h.queryLists.map((queries) => new QueriesObserver(h.client, queries))
    for (const observer of observers) cleanups.push(observer.subscribe(() => {}))
    const prefetch = h.api.dashboardPrefetchOptions().map((options) => h.client.fetchQuery(options))
    await Promise.all(prefetch.slice(0, 2))
    await settle()
    assert.ok(observers[1].getCurrentResult().every((result) => result.isSuccess))
    assert.ok(observers[0].getCurrentResult().some((result) => result.isPending))
    completeDocuments(new Response(null, { headers: { 'Content-Range': '0-0/1' } }))
    await Promise.all(prefetch)
  } finally { completeDocuments(new Response(null)); cleanups.forEach((cleanup) => cleanup()); h.client.clear() }
})

test('un reintento del SDK no recibe el contexto como signal ni falla al quitar listeners', async () => {
  const h = prepararDashboard((_table, call) => call === 1 ? new Response('', { status: 503 }) : undefined)
  try {
    const data = await h.client.fetchQuery(h.api.dashboardPrefetchOptions()[0])
    assert.equal(data.indicador.valor, 1)
    assert.equal(h.requests.length, 2)
    assert.ok(h.requests.every((request) => typeof request.signal.removeEventListener === 'function'))
  } finally { h.client.clear() }
})

test('cada método que omite la autenticación duplicada valida la sesión en su handler', async () => {
  const { API_WITH_ROUTE_AUTH } = loadModule('lib/server/apiAuthentication.ts')
  for (const [path, methods] of Object.entries(API_WITH_ROUTE_AUTH)) {
    for (const method of methods) {
      let checks = 0
      const auth = {
        getAuthToken: (request) => request.headers.get('authorization')?.slice(7),
        getCurrentUser: async () => { checks++; return null },
      }
      const mocks = {
        'next/server': { NextResponse: {
          next: (options) => ({ status: 200, forwarded: options.request.headers }),
          json: (_body, options = {}) => ({ status: options.status ?? 200 }),
        } },
        '@/lib/server/auth': auth,
        '@/lib/server/supabase-admin': { createServiceClient: () => { throw new Error('No debe leer datos sin sesión') } },
        '@/lib/server/drive': {},
        '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'local' },
      }
      const globals = { Headers, process: { env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://qms.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'publishable-test',
      } } }
      const { proxy } = loadModule('proxy.ts', mocks, globals)
      const request = new Request('https://app.test' + path, { method, headers: {
        authorization: 'Bearer inválido', 'x-user-id': 'falso', 'x-user-role': 'admin',
      } })
      const forwarded = await proxy({ headers: request.headers, nextUrl: new URL(request.url), method, signal: request.signal })
      assert.equal(forwarded.status, 200, `${method} ${path} delega al guard del handler`)
      assert.equal(checks, 0)
      assert.equal(forwarded.forwarded.get('x-user-role'), null)
      const route = loadModule('app' + path + '/route.ts', mocks, globals)
      const response = await route[method](new Request(request, { headers: forwarded.forwarded }))
      assert.equal(response.status, 401, `${method} ${path} rechaza token inválido`)
      assert.equal(checks, 1, `${method} ${path} valida la sesión exactamente una vez`)
    }
  }
})
