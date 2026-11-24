import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { QueryClient, QueryObserver } from '@tanstack/query-core'
import { loadModule } from './load-module.mjs'

const model = loadModule('lib/utils/dashboardQuejas.ts')
const { dashboardPeriod, summarizeDashboard } = model
const now = new Date('2026-11-24T17:00:00Z')
const period = dashboardPeriod('year', now)
const caseRow = (id, fecha, estado, tipo = 'Queja', area_afectada = 'Área A') => ({ id, fecha, estado, tipo, area_afectada })
const run = (id, case_id, stage_id, started_at, expires_at, ended_at, end_event, provenance = 'configured') => ({ id, case_id, stage_id, started_at, expires_at, ended_at, end_event, provenance })
const cases = [
  caseRow('a', '2026-01-02T12:00:00Z', 'Finalizado'),
  caseRow('b', '2026-11-02T12:00:00Z', 'No Procede'),
  caseRow('c', '2026-11-03T12:00:00Z', 'Recibido'),
  caseRow('d', '2026-11-04T12:00:00Z', 'Resuelto', 'Felicitación', 'Área B'),
  caseRow('old', '2025-12-01T12:00:00Z', 'Resuelto'),
  caseRow('unknown', '2026-11-05T12:00:00Z', 'Finalizado', 'Reclamo', null),
]
const events = [
  { id: 1, case_id: 'a', occurred_at: '2026-01-12T12:00:00Z' },
  { id: 2, case_id: 'old', occurred_at: '2026-01-15T12:00:00Z' },
  { id: 3, case_id: 'unknown', occurred_at: '2026-11-08T12:00:00Z' },
]
const runs = [
  run('ra', 'a', 'quejas.investigation', '2026-01-04T12:00:00Z', '2026-01-20T12:00:00Z', '2026-01-12T12:00:00Z', 'Resuelto'),
  run('ro', 'old', 'quejas.investigation', '2025-12-04T12:00:00Z', '2026-01-10T12:00:00Z', '2026-01-15T12:00:00Z', 'Resuelto'),
  run('ru', 'unknown', 'quejas.investigation', '2026-11-05T12:00:00Z', '2026-11-20T12:00:00Z', '2026-11-08T12:00:00Z', 'Resuelto', 'legacy_unknown'),
  run('ev', 'b', 'quejas.evaluation', '2026-11-02T12:00:00Z', '2026-11-05T12:00:00Z', '2026-11-03T12:00:00Z', 'No Procede'),
]

test('períodos civiles de Costa Rica, seis meses cruzando año y año anterior completo', () => {
  assert.equal(period.start, '2026-01-01T00:00:00-06:00')
  assert.equal(period.end, '2026-12-01T00:00:00-06:00')
  assert.equal(period.months.length, 11)
  const six = dashboardPeriod('six', new Date('2026-02-02T12:00:00Z'))
  assert.deepEqual(Array.from(six.months), ['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02'])
  assert.equal(dashboardPeriod('previous', now).months.length, 12)
  assert.equal(dashboardPeriod('year', new Date('2027-01-01T04:00:00Z')).year, 2026)
})

test('agregación usa plazos persistidos, excluye felicitaciones y pendientes de procedencia y separa cohortes', () => {
  const data = summarizeDashboard(period, cases, events, runs)
  assert.equal(data.received, 5)
  assert.equal(data.active, 2)
  assert.equal(data.procedure.good, 2)
  assert.equal(data.procedure.total, 3)
  assert.equal(data.resolution.good, 1)
  assert.equal(data.resolution.total, 2)
  assert.equal(data.observed, 3)
  assert.equal(data.durationTotal, 3)
  assert.equal(data.monthly[0].received, 1)
  assert.equal(data.monthly[0].resolvedOnTime, 1)
  assert.equal(data.monthly[0].resolvedEvaluable, 2)
  assert.equal(data.evaluation.good, 1)
  assert.equal(data.investigation.total, 2)
  assert.equal(data.investigation.good, 1)
  assert.equal(data.areas.length, 1)
  assert.equal(data.areas[0].area, 'Área A')
  assert.equal(data.areas[0].count, 1)
  assert.equal(data.distribution.reduce((sum, s) => sum + s.count, 0), data.received)
})

test('no inventa cumplimiento ni duraciones sin datos y no reutiliza una investigación', () => {
  const empty = summarizeDashboard(period, [], [], [])
  assert.equal(empty.resolution.total, 0)
  assert.equal(empty.procedure.total, 0)
  assert.equal(empty.average, null)
  assert.equal(empty.evaluation.total, 0)
  const repeat = summarizeDashboard(period, cases, [...events, { id: 10, case_id: 'a', occurred_at: '2026-01-14T12:00:00Z' }], runs)
  assert.equal(repeat.resolution.total, 2)
  assert.equal(repeat.resolution.good, 1)
})

function transport(intercept) {
  const requests = []
  const supabase = createClient('https://qms.test', 'publishable-test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      const parsed = new URL(url)
      const table = parsed.pathname.split('/').at(-1)
      requests.push({ table, signal: options.signal, params: parsed.searchParams })
      assert.equal(typeof options.signal?.addEventListener, 'function')
      assert.equal(typeof options.signal?.removeEventListener, 'function')
      const intercepted = await intercept?.(table, options, parsed)
      if (intercepted) return intercepted
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
    } },
  })
  const options = []
  const api = loadModule('lib/queries/useDashboard.ts', {
    '@/lib/supabase': { supabase },
    '@tanstack/react-query': { useQuery: config => { options.push(config); return {} } },
  })
  return { api, options, requests, client: new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }) }
}

test('precarga y vista comparten período y AbortSignal; pestaña inactiva no consulta', async () => {
  const h = transport()
  const cleanups = []
  try {
    const prefetch = h.api.dashboardPrefetchOptions()
    assert.equal(prefetch.length, 1)
    await h.client.prefetchQuery(prefetch[0])
    assert.equal(h.requests.length, 4)
    assert.deepEqual([...new Set(h.requests.map(x => x.table))].sort(), ['qms_case_events','qms_quejas','qms_stage_runs'])
    assert.ok(h.requests.every(x => !x.params.get('select')?.includes('cliente_nombre')))
    const realPeriod = dashboardPeriod('year')
    h.api.useDashboardQuejas(realPeriod, true)
    const observer = new QueryObserver(h.client, h.options.at(-1))
    cleanups.push(observer.subscribe(() => {}))
    assert.ok(observer.getCurrentResult().data)
    assert.equal(h.requests.length, 4)
    h.api.useDashboardQuejas(dashboardPeriod('six'), false)
    const hidden = new QueryObserver(h.client, h.options.at(-1))
    cleanups.push(hidden.subscribe(() => {}))
    assert.equal(hidden.getCurrentResult().fetchStatus, 'idle')
    assert.equal(h.requests.length, 4)
    const six = h.api.dashboardQuejasOptions(dashboardPeriod('six'))
    assert.notDeepEqual(Array.from(six.queryKey), Array.from(prefetch[0].queryKey))
    await h.client.fetchQuery(six)
    assert.equal(h.requests.length, 8)
  } finally { cleanups.forEach(fn => fn()); h.client.clear() }
})

test('cancelar el período aborta todas las lecturas iniciales', async () => {
  const h = transport((_table, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')), { once: true })
  }))
  const controller = new AbortController()
  const pending = h.api.fetchDashboardQuejas(period, controller.signal)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(h.requests.length, 4)
  controller.abort()
  await assert.rejects(pending)
  assert.ok(h.requests.every(x => x.signal.aborted))
})

test('pestañas, período y permiso controlan la consulta y nunca montan registros ni actividad', () => {
  let cursor = 0, permitted = true, activeRequests = []
  const state = []
  const data = { metrics: summarizeDashboard(period, cases, events, runs), hasPrevious: true }
  const { default: Page } = loadModule('app/page.tsx', {
    react: {
      useState: initial => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
      useRef: initial => ({ current: initial }), useEffect() {},
    },
    'react-dom': { flushSync: fn => fn() },
    '@tanstack/react-query': { useQueryClient: () => ({ getQueryData: () => data }) },
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ user: { rol: 'calidad' }, permisos: [] }) },
    '@/lib/permisos': { tienePermiso: () => permitted },
    '@/hooks/useRealtimeSubscription': { useRealtimeSubscription: config => { assert.equal(config.enabled, activeRequests.at(-1).enabled) } },
    '@/lib/queries/useDashboard': {
      dashboardQuejasKey: ['dashboard','quejas-ejecutivo'], dashboardQuejasOptions: () => ({queryKey:[]}),
      useDashboardQuejas: (p, enabled) => { activeRequests.push({p, enabled}); return { data, isPending: false, error: null } },
    },
    '@/components/ui/DeferredMount': { default: 'DeferredMount' },
    '@/components/ui/PageHeader': { default: 'PageHeader' },
    '@/components/dashboard/DashboardLoading': { default: 'DashboardLoading' },
    '@/components/dashboard/QuejasSummary': { default: 'QuejasSummary' },
    '@/lib/utils/logger': { logger: { error() {} } },
  })
  const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value?.props ? [value, ...nodes(value.props.children)] : []
  const render = () => { cursor = 0; return nodes(Page()) }
  let tree = render()
  assert.equal(tree.filter(n => n.props.role === 'tab').length, 7)
  assert.equal(tree.find(n => n.props.role === 'tab' && n.props['aria-selected']).props.id, 'dashboard-tab-quejas')
  assert.equal(tree.filter(n => n.type === 'DeferredMount' && n.props.active).length, 1)
  assert.ok(activeRequests.at(-1).enabled)
  assert.equal(tree.find(n => n.type === 'select').props.value, 'year')
  assert.ok(tree.some(n => n.type === 'option' && n.props.value === 'previous'))
  tree.find(n => n.type === 'select').props.onChange({target:{value:'six'}})
  tree = render()
  assert.equal(activeRequests.at(-1).p.months.length, 6)
  tree.find(n => n.props.id === 'dashboard-tab-sacp').props.onClick()
  tree = render()
  assert.equal(activeRequests.at(-1).enabled, false)
  assert.equal(tree.find(n => n.props.id === 'dashboard-panel-quejas').props.hidden, true)
  assert.ok(tree.some(n => n.type === 'p' && n.props.children === 'Módulo en preparación · Sin indicadores activos'))
  assert.ok(!tree.some(n => n.type === 'table'))
  tree.find(n => n.props.id === 'dashboard-tab-quejas').props.onClick()
  permitted = false
  tree = render()
  assert.equal(activeRequests.at(-1).enabled, false)
  assert.ok(!tree.some(n => n.type === 'QuejasSummary'))
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
        '@/lib/server/accessIdentity': {getAccessIdentity:async()=>{checks++;return null}},
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
