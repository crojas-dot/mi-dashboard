import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createClient } from '@supabase/supabase-js'
import { QueryObserver } from '@tanstack/query-core'
import { loadModule, fakeDatabase } from './load-module.mjs'

test('normaliza status HTTP y códigos Supabase sin exponer diagnósticos', () => {
  const { normalizeApiError } = loadModule('lib/errors/apiError.ts')
  for (const [status, message] of [[401, 'No tienes permiso'], [403, 'No tienes permiso'],
    [404, 'Recurso no encontrado'], [429, 'Demasiadas solicitudes'], [500, 'Error del servidor'], [503, 'Error del servidor']]) {
    const result = normalizeApiError({ status, message: 'Bearer privado', details: 'SELECT * FROM usuarios' })
    assert.equal(result.status, status)
    assert.equal(result.message, message)
    assert.doesNotMatch(JSON.stringify(result), /privado|SELECT/)
  }
  assert.equal(normalizeApiError({ code: '42501' }).status, 403)
  assert.equal(normalizeApiError({ code: 'PGRST301' }).status, 401)
})

test('logger usa contexto y timestamp tanto en servidor como cliente sin publicar errores crudos', () => {
  for (const environment of ['server', 'client']) {
    const records = []
    const { logger } = loadModule('lib/utils/logger.ts', {}, {
      console: { log: (record) => records.push(record) }, ...(environment === 'client' ? { window: {} } : {}),
    })
    logger.error('Consulta fallida', { module: 'dashboard', action: 'leer', userId: 'u1' },
      { code: '42501', details: 'private_customer', message: 'secret=privado', token: 'token-privado' })
    assert.equal(records[0].environment, environment)
    assert.equal(records[0].level, 'ERROR')
    assert.match(records[0].timestamp, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(records[0].userId, 'u1')
    assert.equal(records[0].code, '42501')
    assert.doesNotMatch(JSON.stringify(records), /privado|private_customer/)
  }
})

function proxyFixture(user) {
  const checks = []
  const { proxy } = loadModule('proxy.ts', {
    'next/server': { NextResponse: {
      next: (options) => ({ status: 200, forwarded: options.request.headers }),
      json: (body, options) => ({ body, status: options.status }),
    } },
    '@/lib/server/auth': {
      getAuthToken: (request) => request.headers.get('authorization')?.startsWith('Bearer ') ? 'prueba' : null,
      getCurrentUser: async () => { checks.push('auth'); return user },
    },
  }, { Headers })
  const run = (path, method = 'GET') => proxy({ nextUrl: { pathname: path }, method,
    headers: new Headers({ 'x-user-id': 'falso', 'x-user-role': 'admin', 'x-user-email': 'falso@example.test',
      ...(user ? { authorization: 'Bearer prueba' } : {}),
    }) })
  return { checks, run }
}

test('proxy devuelve 401 sin sesión y los encabezados del cliente no otorgan identidad', async () => {
  assert.equal((await proxyFixture(null).run('/api/usuarios')).status, 401)
  const user = { id: 'perfil-1', auth_id: 'auth-1', rol: 'calidad', email: 'real@example.test' }
  const api = proxyFixture(user)
  const response = await api.run('/api/no-registrada')
  assert.equal(response.forwarded.get('x-user-id'), 'perfil-1')
  assert.equal(response.forwarded.get('x-user-role'), 'calidad')
  assert.equal(response.forwarded.get('x-user-email'), 'real@example.test')
  const delegated = await api.run('/api/usuarios')
  assert.equal(delegated.forwarded.get('x-user-id'), null)
  assert.equal(delegated.forwarded.get('x-user-role'), null)
})

test('Calidad puede leer el directorio de responsables y no recibe permiso de escritura', async () => {
  const user = { id: 'perfil-1', rol: 'calidad', email: 'real@example.test' }
  const db = fakeDatabase({ usuarios: [] })
  const api = loadModule('app/api/usuarios/route.ts', {
    'next/server': { NextResponse: { json: (_body, options = {}) => ({ status: options.status ?? 200 }) } },
    '@/lib/server/auth': { getCurrentUser: async () => user },
    '@/lib/server/supabase-admin': { createServiceClient: () => db.supabase },
    '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'local' },
  })
  assert.equal((await api.GET(new Request('https://app.test/api/usuarios'))).status, 200)
  assert.equal((await api.POST(new Request('https://app.test/api/usuarios', { method: 'POST' }))).status, 403)
})

test('solo la subida pública exacta queda exenta de autenticación entre las API', async () => {
  const api = proxyFixture(null)
  const response = await api.run('/api/drive/upload-public', 'POST')
  assert.equal(response.status, 200)
  assert.equal(api.checks.length, 0)
  assert.equal(response.forwarded.get('x-user-role'), null)
  for (const path of ['/api/drive/upload', '/api/drive/upload-public/extra', '/api/algo']) {
    assert.equal((await api.run(path)).status, 401)
  }
})

function queryClientFixture() {
  const { default: QueryProvider } = loadModule('lib/providers/QueryProvider.tsx', {
    react: { useState: (initialize) => [initialize()], useEffect: () => {} },
    '@/lib/store/auth-store': { useAuthStore: (selector) => selector({ user: null, vistaActiva: null }) },
    '@/lib/utils/logger': { logger: { error() {} } },
  })
  const provider = QueryProvider({ children: null })
  return provider.type(provider.props).props.client
}

test('la caché asigna plazos por prefijo y no reintenta errores de autorización', () => {
  const client = queryClientFixture()
  try {
    for (const [key, staleTime, gcTime] of [['dashboard', 60000, 300000], ['quejas', 30000, 180000],
      ['notificaciones', 15000, 60000], ['configuraciones_sistema', 600000, 1800000], ['permisos', 600000, 1800000]]) {
      const options = client.defaultQueryOptions({ queryKey: [key, 'detalle'] })
      assert.equal(options.staleTime, staleTime)
      assert.equal(options.gcTime, gcTime)
      assert.equal(options.retry(0, { status: 401 }), false)
      assert.equal(options.retry(0, { status: 403 }), false)
      assert.equal(options.retry(0, { code: '42501' }), false)
      assert.equal(options.retry(0, new TypeError('Failed to fetch')), true)
      assert.equal(options.retry(1, new TypeError('Failed to fetch')), false)
    }
  } finally { client.clear() }
})

test('una consulta fresca se reutiliza y el remontaje recupera datos invalidados una sola vez', async () => {
  const client = queryClientFixture()
  let unsubscribe = () => {}
  try {
    let fetches = 0
    const options = { queryKey: ['dashboard', 'tareas'], queryFn: async () => ++fetches }
    await Promise.all([client.fetchQuery(options), client.fetchQuery(options)])
    assert.equal(fetches, 1)
    await client.fetchQuery(options)
    assert.equal(fetches, 1)
    await client.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'none' })
    const observer = new QueryObserver(client, options)
    unsubscribe = observer.subscribe(() => {})
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(fetches, 2)
  } finally { unsubscribe(); client.clear() }
})

test('las tareas cargan aunque fallen los conteos de documentos y conservan los vencimientos', async () => {
  const db = fakeDatabase({ quejas: [
    { id: 'q1', cliente_nombre: 'Caso', estado: 'En Investigación', fecha_sla: '2026-10-08' },
    { id: 'q2', estado: 'Finalizado', fecha_sla: '2026-10-01' },
  ], acciones: [{ id: 'a1', folio: 'SACP-1', tipo: 'Correctiva', estado: 'Abierta', fecha_limite: '2026-10-07' }] },
  { documentos: new Error('Documentos inaccesibles') })
  const api = loadModule('lib/queries/useDashboard.ts', { '@/lib/supabase': db, '@tanstack/react-query': {} })
  await assert.rejects(api.fetchDashboardIndicadores(), /Documentos inaccesibles/)
  assert.deepEqual(Array.from(await api.fetchDashboardTareas(), (row) => row.id), ['a1', 'q1'])
})

test('abandonar un bloque del dashboard aborta el transporte Supabase', async () => {
  const signals = []
  const supabase = createClient('https://qms.test', 'publishable-test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (_url, options) => new Promise((_resolve, reject) => {
      signals.push(options.signal)
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }) },
  })
  const { fetchDashboardTareas } = loadModule('lib/queries/useDashboard.ts', {
    '@/lib/supabase': { supabase }, '@tanstack/react-query': {},
  })
  const controller = new AbortController()
  const pending = fetchDashboardTareas(controller.signal)
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(signals.length, 2)
  controller.abort()
  await assert.rejects(pending)
  assert.ok(signals.every((signal) => signal.aborted))
})

test('un bloque fallido no oculta la actividad ni los expedientes cargados', () => {
  const { default: Dashboard } = loadModule('app/page.tsx', {
    react: { ...React, lazy: () => () => null },
    '@/lib/queries/useDashboard': {
      useDashboardIndicadores: () => ({ error: new Error('BD'), isPending: false, refetch() {} }),
      useDashboardTareas: () => ({ data: [{ id: 'q1', titulo: 'Expediente visible', tipo: 'Queja', estado: 'Recibido', vence: '' }], isPending: false }),
      useActividadReciente: () => ({ data: [{ id: 'act1', descripcion: 'Actividad visible', created_at: '2026-10-06' }], isPending: false }),
    },
    '@/lib/utils/logger': { logger: { error() {} } },
  })
  const html = renderToStaticMarkup(createElement(Dashboard))
  assert.match(html, /No se pudo cargar el dashboard/)
  assert.match(html, /Expediente visible/)
  assert.match(html, /Actividad visible/)
})

