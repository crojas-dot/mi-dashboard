import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { QueryClient, MutationObserver } from '@tanstack/react-query'
import { loadModule } from './load-module.mjs'

const sdk = fetch => createClient('https://qms.test', 'publishable-test', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
})
const operations = [
  ['marcarLeida', ['notification-demo']],
  ['marcarTodasLeidas', ['perfil-demo']],
  ['archivarNotificacion', ['notification-demo']],
  ['archivarTodasVisibles', ['perfil-demo']],
]

for (const [operation, args] of operations) {
  test(operation + ': un rechazo real del transporte llega al consumidor sin fingir éxito', async () => {
    let requests = 0
    const supabase = sdk(async () => {
      requests++
      return Response.json({ code: '42501', message: 'denegado' }, { status: 403 })
    })
    const service = loadModule('lib/services/notificacionService.ts', { '@/lib/supabase': { supabase } })
    await assert.rejects(service[operation](...args), error => error.code === '42501')
    assert.equal(requests, 1)
  })
}

for (const operation of ['marcarLeida', 'archivarNotificacion']) {
  test(operation + ': cero filas visibles no confirma un cambio individual y solo solicita el ID', async () => {
    let request
    const supabase = sdk(async (url, options) => {
      request = { url: new URL(url), options }
      return Response.json({ code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object', details: 'The result contains 0 rows' }, { status: 406 })
    })
    const service = loadModule('lib/services/notificacionService.ts', { '@/lib/supabase': { supabase } })
    await assert.rejects(service[operation]('notification-demo'), error => error.code === 'PGRST116')
    assert.equal(request.options.method, 'PATCH')
    assert.equal(request.url.searchParams.get('id'), 'eq.notification-demo')
    assert.equal(request.url.searchParams.get('select'), 'id')
    assert.equal(new Headers(request.options.headers).get('Accept'), 'application/vnd.pgrst.object+json')
  })
}

test('acciones masivas vacías son idempotentes y conservan usuario propio y los filtros booleanos existentes', async () => {
  const requests = []
  const supabase = sdk(async (url, options) => {
    requests.push({ url: new URL(url), options })
    return new Response(null, { status: 204 })
  })
  const service = loadModule('lib/services/notificacionService.ts', { '@/lib/supabase': { supabase } })
  await service.marcarTodasLeidas('perfil-demo')
  await service.archivarTodasVisibles('perfil-demo')
  assert.equal(requests.length, 2)
  assert.ok(requests.every(request => request.url.searchParams.get('usuario_id') === 'eq.perfil-demo'))
  assert.ok(requests.every(request => request.url.searchParams.get('archivada') === 'eq.false'))
  assert.equal(requests[0].url.searchParams.get('leida'), 'eq.false')
  assert.equal(requests[1].url.searchParams.has('leida'), false)
})

const hooks = [
  ['useMarcarNotificacionLeida', { id: 'notification-demo', userId: 'perfil-demo' }],
  ['useMarcarTodasLeidas', 'perfil-demo'],
  ['useArchivarNotificacion', { id: 'notification-demo', userId: 'perfil-demo' }],
  ['useArchivarTodas', 'perfil-demo'],
]
for (const [hook, input] of hooks) {
  test(hook + ': fallo no invalida ni reemplaza la bandeja y el aviso oculta diagnósticos', async () => {
    const toasts = [], warnings = [], invalidations = []
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const cached = [{ id: 'notification-demo', leida: false, archivada: false }]
    client.setQueryData(['notificaciones', 'perfil-demo'], cached)
    const supabase = sdk(async () => Response.json({ code: '42501', message: 'select private from source', details: 'https://private.test' }, { status: 403 }))
    const api = loadModule('lib/queries/useNotificaciones.ts', {
      '@/lib/supabase': { supabase },
      '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => ({ invalidateQueries: value => invalidations.push(value) }) },
      sonner: { toast: { error: message => toasts.push(message) } },
    }, { console: { warn: (...args) => warnings.push(args) } })
    const observer = new MutationObserver(client, api[hook]())
    await assert.rejects(observer.mutate(input), error => error.code === '42501')
    assert.equal(observer.getCurrentResult().status, 'error')
    assert.equal(invalidations.length, 0)
    assert.deepEqual(client.getQueryData(['notificaciones', 'perfil-demo']), cached)
    assert.deepEqual(toasts, ['Tu usuario no tiene permiso para esta operación.'])
    assert.doesNotMatch(JSON.stringify(toasts.concat(warnings)), /private|select/)
    client.clear()
  })

  test(hook + ': guardado confirmado invalida únicamente la bandeja del usuario indicado', async () => {
    const invalidations = [], toasts = []
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const supabase = sdk(async (_url, options) => new Headers(options.headers).get('Accept') === 'application/vnd.pgrst.object+json'
      ? Response.json({ id: 'notification-demo' }) : new Response(null, { status: 204 }))
    const api = loadModule('lib/queries/useNotificaciones.ts', {
      '@/lib/supabase': { supabase },
      '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => ({ invalidateQueries: value => invalidations.push(value) }) },
      sonner: { toast: { error: message => toasts.push(message) } },
    })
    const observer = new MutationObserver(client, api[hook]())
    await observer.mutate(input)
    assert.equal(observer.getCurrentResult().status, 'success')
    assert.deepEqual(JSON.parse(JSON.stringify(invalidations)), [{ queryKey: ['notificaciones', 'perfil-demo'] }])
    assert.equal(toasts.length, 0)
    client.clear()
  })
}
