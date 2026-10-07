import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, fakeDatabase } from './load-module.mjs'

const accessHelper = loadModule('lib/server/ultimoAcceso.ts').completarUltimoAcceso

test('último acceso viene de Auth y su respuesta no contiene metadatos privados', async () => {
  const calls = []
  const admin = { auth: { admin: { async listUsers(params) {
    calls.push(params)
    return { data: { users: [{ id: 'a', last_sign_in_at: '2026-10-06T15:00:00Z', app_metadata: { privado: 'no-devolver' } }, { id: 'b' }] }, error: null }
  } } } }
  const result = await accessHelper(admin, [{ id: 'p1', auth_id: 'a', ultimo_acceso: '2020-01-01' }, { id: 'p2', auth_id: 'b' }, { id: 'p3', ultimo_acceso: '2026-01-01' }])
  assert.equal(result[0].ultimo_acceso, '2026-10-06T15:00:00Z')
  assert.equal(result[1].ultimo_acceso, null)
  assert.equal(result[2].ultimo_acceso, '2026-01-01')
  assert.equal(calls.length, 1)
  assert.doesNotMatch(JSON.stringify(result), /privado|app_metadata|no-devolver/)
})

test('Auth se consulta por páginas, sin una solicitud por perfil ni bucles con identidades ausentes', async () => {
  const calls = []
  const admin = { auth: { admin: { async listUsers(params) {
    calls.push(params)
    return { data: { users: params.page === 1 ? Array.from({ length: 1000 }, (_, id) => ({ id: `otro-${id}` })) : [{ id: 'a', last_sign_in_at: '2026-10-06' }] }, error: null }
  } } } }
  const result = await accessHelper(admin, [{ auth_id: 'a' }, { auth_id: 'ausente' }])
  assert.deepEqual(calls.map(call => [call.page, call.perPage]), [[1, 1000], [2, 1000]])
  assert.equal(result[0].ultimo_acceso, '2026-10-06')
  assert.equal(result[1].ultimo_acceso, null)
  assert.equal((await accessHelper(admin, [])).length, 0)
  assert.equal(calls.length, 2)
})

test('fallos de Auth se propagan sin inventar que el usuario nunca inició sesión', async () => {
  const failure = new Error('Auth no disponible')
  await assert.rejects(accessHelper({ auth: { admin: { async listUsers() { return { error: failure } } } } }, [{ auth_id: 'a' }]), error => error === failure)
})

test('la API conserva autorización admin/calidad y no consulta Auth ante solicitudes no autorizadas', async () => {
  for (const [user, expected] of [[null, 401], [{ rol: 'colaborador' }, 403], [{ rol: 'admin' }, 200], [{ rol: 'calidad' }, 200]]) {
    let called = 0
    const db = fakeDatabase({ usuarios: [{ id: 'perfil', auth_id: 'a' }] })
    const api = loadModule('app/api/usuarios/route.ts', {
      'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
      '@/lib/server/auth': { getCurrentUser: async () => user },
      '@/lib/server/supabase-admin': { createServiceClient: () => db.supabase },
      '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'local' },
      '@/lib/server/ultimoAcceso': { completarUltimoAcceso: async (_admin, profiles) => { called++; return profiles.map(profile => ({ ...profile, ultimo_acceso: '2026-10-06' })) } },
    })
    const response = await api.GET(new Request('https://app.test/api/usuarios'))
    assert.equal(response.status, expected)
    assert.equal(called, expected === 200 ? 1 : 0)
    if (expected === 200) assert.equal(response.body[0].ultimo_acceso, '2026-10-06')
  }
})

function workflowFixture(failure = null) {
  const calls = []
  const api = loadModule('lib/services/quejaWorkflowService.ts', {
    '@/lib/supabase': { supabase: { async rpc(name, args) { calls.push({ name, args }); return { data: { id: args.p_id, revision: args.p_expected + 1 }, error: failure } } } },
  })
  return { ...api, calls }
}

test('la API devuelve un fallo recuperable de Auth sin exponer su diagnóstico ni fingir ausencia de accesos', async () => {
  const db = fakeDatabase({ usuarios: [{ id: 'perfil', auth_id: 'a' }] })
  const api = loadModule('app/api/usuarios/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    '@/lib/server/auth': { getCurrentUser: async () => ({ rol: 'admin' }) },
    '@/lib/server/supabase-admin': { createServiceClient: () => db.supabase },
    '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'local' },
    '@/lib/server/ultimoAcceso': { completarUltimoAcceso: async () => { throw new Error('Diagnóstico privado') } },
    '@/lib/utils/logger': { logger: { error() {} } },
  })
  const response = await api.GET(new Request('https://app.test/api/usuarios'))
  assert.equal(response.status, 502)
  assert.doesNotMatch(JSON.stringify(response.body), /privado/)
})

test('asignar y transicionar usa el wrapper vigente con la revisión editada y código estable', async () => {
  const api = workflowFixture()
  const queja = { id: 'q1', revision: 7 }
  const updated = await api.transicionarQueja(queja, 'En Investigación', { responsableId: 'responsable', justificacionProcede: '  Procede  ' })
  assert.equal(updated.revision, 8)
  assert.equal(api.calls[0].name, 'qms_transition')
  assert.deepEqual(JSON.parse(JSON.stringify(api.calls[0].args)), { p_id: 'q1', p_expected: 7, p_state: 'investigation', p_resolution: null, p_justification: 'Procede', p_owner: 'responsable', p_reopen: null })
  await api.actualizarDetallesQueja({ quejaId: 'q1', revision: updated.revision, responsableId: 'otro' })
  assert.equal(api.calls[1].name, 'qms_update_details')
  assert.equal(api.calls[1].args.p_expected, 8)
  assert.equal(api.calls[1].args.p_owner, 'otro')
  await api.reabrirQueja({ id: 'q1', revision: 9 }, ' Motivo ')
  assert.equal(api.calls[2].name, 'qms_transition')
  assert.equal(api.calls[2].args.p_reopen, 'Motivo')
})

test('no se lee una revisión fresca ni se reintenta un conflicto para sobrescribir otro cambio', async () => {
  const error = { code: '40001', message: 'Otra persona modificó la queja' }
  const api = workflowFixture(error)
  await assert.rejects(api.transicionarQueja({ id: 'q1', revision: 4 }, 'Resuelto'), failure => failure === error)
  assert.equal(api.calls.length, 1)
  assert.throws(() => api.transicionarQueja({ id: 'q1' }, 'Resuelto'), /Actualiza el expediente/)
  assert.throws(() => api.transicionarQueja({ id: 'q1', revision: 4 }, 'Inventado'), /Estado no reconocido/)
  assert.equal(api.calls.length, 1)
  const { getUserError } = loadModule('lib/errors/userError.ts')
  assert.equal(getUserError(error).retryable, false)
  assert.match(getUserError(error).message, /Otra persona/)
})
