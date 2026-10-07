import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

// Ejercita los handlers reales sin crear usuarios ni modificar contraseñas reales.
function modalHarness(file, overrides = {}) {
  const slots = [], requests = [], errors = [], successes = []
  let cursor = 0, tree, closes = 0, generated = 0
  const state = (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [slots[index], (value) => { slots[index] = value }]
  }
  const request = (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }))
  const props = { open: true, mode: 'crear', usuario: null, onClose: () => closes++,
    onSuccess: (result) => successes.push(result), onSaved: () => successes.push('saved'),
    onDelete: (user) => request('DELETE', user), ...overrides }
  const { default: Modal } = loadModule(file, {
    react: { useState: state, useRef: (current) => state({ current })[0], useEffect() {} },
    '@/components/ui/tailwind/Tabs': { Tabs: 'Tabs', Tab: 'Tab' },
    '@/components/ui/icons': new Proxy({}, { get: (_, key) => key }),
    '@/components/ui/tailwind/Modal': { default: 'Modal' },
    '@/components/ui/tailwind/Button': { default: 'Button' },
    '@/components/ui/tailwind/Select': { default: 'Select' },
    '@/lib/queries/useUsuarios': { mutateUsuario: request },
    '@/lib/services/passwordGenerator': { generatePassword: () => `Generated-${++generated}` },
    '@/lib/services/errorToast': { showError: (...args) => errors.push(args), showSuccess() {} },
  }, { FormData: class { constructor(values) { this.values = values } get(name) { return this.values[name] ?? null } } })
  const visit = (value) => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
  const text = (value) => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : ''
  const render = () => { cursor = 0; tree = Modal(props); return tree }
  render()
  return { requests, errors, successes, props, render,
    button: (label) => visit(tree).find((node) => node.type === 'Button' && text(node).trim() === label),
    submit: (values = { nombre: 'Nombre', email: 'persona@example.test', rol: 'colaborador', estado: 'activo' }) =>
      visit(tree).find((node) => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: values }),
    close: () => tree.props.onClose(), closes: () => closes,
  }
}

test('guardar usuario bloquea duplicados y recupera el formulario después de fallo y éxito', async () => {
  const modal = modalHarness('components/usuarios/UsuarioFormModal.tsx')
  const pending = modal.submit()
  await modal.submit() // Segundo evento antes de renderizar el botón disabled.
  assert.equal(modal.requests.length, 1)
  modal.close()
  assert.equal(modal.closes(), 0)
  modal.render()
  assert.equal(modal.button('Crear usuario').props.loading, true)
  modal.requests[0].reject(new TypeError('Failed to fetch'))
  await pending
  modal.render()
  assert.equal(modal.errors.length, 1)
  assert.equal(modal.button('Crear usuario').props.loading, false)
  const retry = modal.submit()
  modal.requests[1].resolve()
  await retry
  modal.props.open = false; modal.render()
  modal.props.open = true; modal.render()
  assert.equal(modal.button('Crear usuario').props.loading, false)
  assert.equal(modal.successes[0].tempPassword, modal.requests[1].args[1].password)
})

test('editar la propia cuenta omite rol y estado deshabilitados', async () => {
  const modal = modalHarness('components/usuarios/UsuarioFormModal.tsx', { mode: 'editar', esAuto: true, usuario: { id: 'yo', rol: 'admin', estado: 'activo' } })
  const pending = modal.submit({ nombre: 'Mi nombre', email: 'yo@example.test' })
  assert.deepEqual({ ...modal.requests[0].args[1] }, { id: 'yo', nombre: 'Mi nombre', email: 'yo@example.test' })
  modal.requests[0].resolve(); await pending
})

test('eliminar usuario recupera el modal si falla la red y no envía doble borrado', async () => {
  const modal = modalHarness('components/usuarios/UsuarioFormModal.tsx', { mode: 'editar', usuario: { id: 'otro', nombre: 'Otro' } })
  modal.button('Eliminar').props.onClick(); modal.render()
  const pending = modal.button('Eliminar').props.onClick()
  await modal.button('Eliminar').props.onClick()
  assert.equal(modal.requests.length, 1)
  modal.requests[0].reject(new TypeError('Failed to fetch'))
  await pending; modal.render()
  assert.equal(modal.button('Eliminar').props.loading, false)
  assert.equal(modal.errors.length, 1)
})

test('reset conserva la contraseña tras un fallo y la limpia después del éxito', async () => {
  const modal = modalHarness('components/usuarios/ResetPasswordModal.tsx', { usuario: { id: 'otro', nombre: 'Otro' } })
  modal.button('Generar').props.onClick(); modal.render()
  const pending = modal.button('Guardar').props.onClick()
  await modal.button('Guardar').props.onClick()
  modal.button('Regenerar').props.onClick()
  modal.close()
  assert.equal(modal.requests.length, 1)
  assert.equal(modal.closes(), 0)
  modal.requests[0].reject(new TypeError('Failed to fetch'))
  await pending; modal.render()
  assert.equal(modal.button('Guardar').props.disabled, false)
  const retry = modal.button('Guardar').props.onClick()
  assert.equal(modal.requests[1].args[1].newPassword, modal.requests[0].args[1].newPassword)
  modal.requests[1].resolve(); await retry; modal.render()
  assert.ok(modal.button('Generar'))
  assert.equal(modal.closes(), 1)
})

test('mutaciones HTTP conservan el status y no repiten un guardado fallido', async () => {
  let calls = 0
  const { mutateUsuario } = loadModule('lib/queries/useUsuarios.ts', {
    '@tanstack/react-query': {},
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'local-test' } } }) } } },
  }, { fetch: async (_url, options) => {
    calls++
    assert.equal(options.headers.Authorization, 'Bearer local-test')
    return Response.json({ error: 'No se puede dejar el sistema sin administradores activos' }, { status: 409 })
  } })
  await assert.rejects(mutateUsuario('PATCH', { id: 'otro', estado: 'inactivo' }, 'No se pudo guardar'), (error) => error.status === 409 && /administradores/.test(error.message))
  assert.equal(calls, 1)
})

test('API Usuarios valida todos los campos antes de acceder a Auth o a la base de datos', async () => {
  let databaseCalls = 0
  const api = loadModule('app/api/usuarios/route.ts', {
    '@/lib/server/supabase-admin': { createServiceClient: () => { databaseCalls++; throw new Error('No debe tocar datos') } },
    '@/lib/server/auth': { getCurrentUser: async () => ({ rol: 'admin', auth_id: '00000000-0000-4000-8000-000000000001' }) },
    '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'test' },
  })
  const validPost = { nombre: 'Prueba', email: 'test@example.test', rol: 'colaborador' }
  for (const [method, payload] of [
    ['POST', []], ['POST', 42], ['POST', { ...validPost, nombre: 42 }],
    ['POST', { ...validPost, rol: 'inventado' }], ['POST', { ...validPost, estado: null }],
    ['POST', { ...validPost, password: 'corta' }],
    ['PATCH', { id: '00000000-0000-4000-8000-000000000002', email: 'nuevo@example.test', newPassword: 'corta' }],
    ['PATCH', { id: '00000000-0000-4000-8000-000000000002', email: {} }], ['PATCH', { id: '00000000-0000-4000-8000-000000000002', rol: null }],
    ['PATCH', { id: '00000000-0000-4000-8000-000000000002', nombre: '   ' }], ['PATCH', { id: '00000000-0000-4000-8000-000000000002' }],
  ]) {
    const response = await api[method](new Request('https://local.test/api/usuarios', { method, body: JSON.stringify(payload) }))
    assert.equal(response.status, 400, JSON.stringify(payload))
    assert.ok((await response.json()).error)
  }
  assert.equal(databaseCalls, 0)
})

test('validación conserva perfiles válidos y no normaliza las contraseñas', () => {
  const { validarUsuarioInput } = loadModule('lib/server/usuarioInput.ts')
  const password = '  Clave-123  '
  const created = validarUsuarioInput({ nombre: ' Persona ', email: ' PERSONA@EXAMPLE.TEST ', rol: 'colaborador', password }, 'POST')
  assert.equal(created.error, undefined)
  assert.deepEqual({ ...created.data }, { nombre: 'Persona', email: 'persona@example.test', rol: 'colaborador', password })
  const edited = validarUsuarioInput({ id: '00000000-0000-4000-8000-000000000001', nombre: 'Nuevo nombre' }, 'PATCH')
  assert.equal(edited.error, undefined)
  assert.deepEqual({ ...edited.data }, { id: '00000000-0000-4000-8000-000000000001', nombre: 'Nuevo nombre' })
})

test('reset solo escribe Auth y cambiar correo/contraseña usa una única petición Auth', async () => {
  for (const extra of [{}, { email: 'NUEVO@EXAMPLE.TEST' }]) {
    const authUpdates = [], profileUpdates = []
    const client = {
      auth: { admin: { updateUserById: async (id, changes) => { authUpdates.push({ id, ...changes }); return { error: null } } } },
      from() {
        const query = {
          select() { return query }, eq() { return query },
          maybeSingle: async () => ({ data: { auth_id: 'auth-otro' }, error: null }),
          update(changes) { profileUpdates.push(changes); return query },
          then(resolve) { return Promise.resolve({ error: null }).then(resolve) },
        }
        return query
      },
    }
    const { PATCH } = loadModule('app/api/usuarios/route.ts', {
      '@/lib/server/supabase-admin': { createServiceClient: () => client },
      '@/lib/server/auth': { getCurrentUser: async () => ({ rol: 'admin', auth_id: '00000000-0000-4000-8000-000000000001' }) },
      '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'test' },
    })
    const response = await PATCH(new Request('https://local.test/api/usuarios', {
      method: 'PATCH', body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000002', newPassword: 'Prueba-123', ...extra }),
    }))
    assert.equal(response.status, 200)
    assert.equal(authUpdates.length, 1)
    assert.equal(authUpdates[0].password, 'Prueba-123')
    assert.equal(profileUpdates.length, extra.email ? 1 : 0)
    if (extra.email) {
      assert.equal(authUpdates[0].email, 'nuevo@example.test')
      assert.equal(profileUpdates[0].email, 'nuevo@example.test')
    }
  }
})
