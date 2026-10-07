import test from 'node:test'
import assert from 'node:assert/strict'
import * as queryCore from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import { loadModule } from './load-module.mjs'

const settle = () => new Promise(setImmediate)
const queryMocks = { ...queryCore, useQuery: (options) => options }
const sdk = (fetch) => createClient('https://qms.test', 'publishable-test', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
})

const reads = [
  ['Adjuntos', 'lib/queries/useQuejas.ts', 'useQuejaAdjuntos', ['queja-demo']],
  ['SLA', 'lib/queries/useQuejas.ts', 'useSLAConfig', ['quejas']],
  ['Estadísticas RPC', 'lib/queries/useQuejas.ts', 'useQuejasEstadisticas', []],
  ['Comentarios', 'lib/queries/useQuejaComentarios.ts', 'useQuejaComentarios', ['queja-demo']],
  ['Actividad', 'lib/queries/useQuejaActividad.ts', 'useQuejaActividad', ['queja-demo']],
  ['Hallazgos', 'lib/queries/useAuditorias.ts', 'useHallazgos', ['auditoria-demo']],
  ['Catálogos', 'lib/queries/useCatalogos.ts', 'useCatalogos', []],
  ['Catálogo por módulo', 'lib/queries/useCatalogos.ts', 'useCatalogoTipo', ['estado_queja', 'quejas']],
  ['Formularios', 'lib/queries/useFormulariosPublicos.ts', 'useFormulariosPublicos', []],
  ['Permisos de configuración', 'lib/queries/usePermisos.ts', 'usePermisos', []],
  ['Matriz de riesgos', 'lib/queries/useRiesgos.ts', 'useMatrizRiesgos', []],
  ['Notificaciones', 'lib/queries/useNotificaciones.ts', 'useNotificaciones', ['perfil-demo']],
]
for (const [name, filename, hook, args] of reads) {
  test(name + ': cancelar la lectura aborta el transporte y conserva el dato previo', async () => {
    let signal
    const supabase = sdk((_url, options) => new Promise((_resolve, reject) => {
      signal = options.signal
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const api = loadModule(filename, { '@/lib/supabase': { supabase }, '@tanstack/react-query': queryMocks })
    const options = { ...api[hook](...args), staleTime: 0 }
    const client = new queryCore.QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    const cached = ['dato anterior']
    client.setQueryData(options.queryKey, cached)
    const observer = new queryCore.QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})
    await settle()
    assert.ok(signal instanceof AbortSignal)
    unsubscribe()
    assert.equal(signal.aborted, true)
    assert.deepEqual(client.getQueryData(options.queryKey), cached)
    client.clear()
  })
}

test('Notificaciones conserva el error de red en lugar de fingir una bandeja vacía', async () => {
  const supabase = sdk(async () => new Response(JSON.stringify({ code: '42501', message: 'denegado' }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  }))
  const { listarNotificaciones } = loadModule('lib/services/notificacionService.ts', { '@/lib/supabase': { supabase } })
  await assert.rejects(listarNotificaciones('perfil-demo'), (error) => error.code === '42501')
})

test('Usuarios cancelado mientras espera Auth no inicia después una consulta API', async () => {
  let releaseSession
  let requests = 0
  const supabase = { auth: { getSession: () => new Promise((resolve) => { releaseSession = resolve }) } }
  const { fetchUsuarios } = loadModule('lib/queries/useUsuarios.ts', { '@/lib/supabase': { supabase } }, {
    URLSearchParams, fetch: async () => { requests++; return new Response('[]') },
  })
  const controller = new AbortController()
  const pending = fetchUsuarios({ search: 'anterior' }, controller.signal)
  controller.abort()
  releaseSession({ data: { session: { access_token: 'test-token' } } })
  await assert.rejects(pending, (error) => error.name === 'AbortError')
  assert.equal(requests, 0)
})

test('Zona horaria cancela GET sin cambiar el contrato PUT de guardado', async () => {
  const calls = []
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } }
  const { useZonaHoraria, guardarZonaHoraria } = loadModule('lib/queries/useZonaHoraria.ts', {
    '@/lib/supabase': { supabase }, '@tanstack/react-query': queryMocks,
  }, { fetch: async (_url, options) => { calls.push(options); return Response.json({ zonaHoraria: 'America/Costa_Rica' }) } })
  const controller = new AbortController()
  const options = useZonaHoraria()
  assert.equal(await options.queryFn({ signal: controller.signal }), 'America/Costa_Rica')
  assert.equal(calls[0].signal, controller.signal)
  assert.equal(calls[0].method, 'GET')
  assert.equal(await guardarZonaHoraria('America/Costa_Rica'), 'America/Costa_Rica')
  assert.equal(calls[1].method, 'PUT')
  assert.equal(calls[1].signal, undefined)
})
