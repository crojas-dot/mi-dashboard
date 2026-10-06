import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { getUserError, retryRead } = loadModule('lib/errors/userError.ts')

test('distingue causas recuperables y evita repetir errores de permiso o validación', () => {
  assert.match(getUserError({ code: '42501' }).message, /permiso/)
  assert.match(getUserError({ status: 401 }).action, /sesión/)
  assert.match(getUserError({ code: '23505' }).message, /existe/)
  assert.equal(retryRead(0, { code: '42501' }), false)
  assert.equal(retryRead(0, { code: '23505' }), false)
  assert.equal(retryRead(0, { status: 400 }), false)
  assert.equal(retryRead(0, new TypeError('Failed to fetch')), true)
  assert.equal(retryRead(1, new TypeError('Failed to fetch')), false)
})

test('no expone diagnósticos SQL, credenciales o URLs en mensajes ni fallback', () => {
  for (const error of [
    { code: '23505', message: 'duplicate private_customer', details: 'email=privado@example.test', hint: 'secret=123' },
    { message: 'Bearer token-privado' },
    { message: 'Error https://example.test?token=privado' },
    { message: 'api_key=privado' },
    { message: 'sk-proj-privado' },
  ]) {
    const info = getUserError(error)
    assert.doesNotMatch(JSON.stringify(info), /privado|private_customer|secret=123/)
  }
  assert.doesNotMatch(getUserError(null, 'token=privado').message, /privado/)
  assert.equal(getUserError({ code: 'P0001', message: 'Debes asignar un responsable.' }).message, 'Debes asignar un responsable.')
})

test('el error visible conserva causa y recuperación accesibles', () => {
  const { default: ErrorState } = loadModule('components/ui/tailwind/ErrorState.tsx')
  const html = renderToStaticMarkup(createElement(ErrorState, {
    error: { code: '42501' }, title: 'No se pudieron cargar las evidencias', onRetry() {}, retrying: true,
  }))
  assert.match(html, /role="alert"/)
  assert.match(html, /No se pudieron cargar las evidencias/)
  assert.match(html, /permiso/)
  assert.match(html, /42501/)
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-busy="true"/)
})

test('el adaptador Button conserva atributos de formulario y accesibilidad', () => {
  const { default: Button } = loadModule('components/ui/tailwind/Button.tsx')
  const html = renderToStaticMarkup(createElement(Button, {
    form: 'editor', name: 'guardar', type: 'submit', 'aria-label': 'Guardar expediente', 'aria-describedby': 'ayuda',
  }, 'Guardar'))
  assert.match(html, /form="editor"/)
  assert.match(html, /aria-label="Guardar expediente"/)
  assert.match(html, /aria-describedby="ayuda"/)
  assert.match(html, /type="submit"/)
})

function authFixture(profile, authError = null) {
  const reads = []
  const { getCurrentUser } = loadModule('lib/server/auth.ts', {
    '@supabase/supabase-js': { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'auth-1', user_metadata: { rol: 'admin' } } }, error: authError }) },
      from(table) {
        const query = {
          select(columns) { reads.push({ table, columns }); return query },
          eq(field, value) { reads.push({ field, value }); return query },
          async maybeSingle() { return { data: profile, error: null } },
        }
        return query
      },
    }) },
  }, { process: { env: {} } })
  return { reads, run: () => getCurrentUser(new Request('https://app.test', { headers: { authorization: 'Bearer prueba' } })) }
}

test('las API rechazan cuentas inactivas aunque su token siga siendo válido', async () => {
  for (const estado of ['inactivo', null, undefined]) {
    const auth = authFixture({ rol: 'admin', email: 'test@example.test', estado })
    assert.equal(await auth.run(), null)
    assert.ok(auth.reads[0].columns.includes('estado'))
  }
})

test('la API toma el rol del perfil activo, nunca del metadata editable', async () => {
  const auth = authFixture({ rol: 'colaborador', email: 'test@example.test', estado: 'activo' })
  const current = await auth.run()
  assert.equal(current.rol, 'colaborador')
  assert.equal(current.auth_id, 'auth-1')
  assert.deepEqual(auth.reads[1], { field: 'auth_id', value: 'auth-1' })
  const expired = authFixture({ rol: 'admin', estado: 'activo' }, new Error('JWT vencido'))
  assert.equal(await expired.run(), null)
  assert.equal(expired.reads.length, 0)
})

test('los errores HTTP conservan status y ocultan diagnósticos de servicios', () => {
  const { createHttpError } = loadModule('lib/errors/httpError.ts')
  const denied = createHttpError(403, 'detalle interno', 'No se pudo guardar')
  assert.equal(denied.status, 403)
  assert.match(denied.message, /permiso/)
  const failed = createHttpError(500, 'secret=privado', 'No se pudo guardar')
  assert.equal(failed.status, 500)
  assert.doesNotMatch(failed.message, /privado/)
  assert.match(getUserError(failed).message, /servicio/)
})
