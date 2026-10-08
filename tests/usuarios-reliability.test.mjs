import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'
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
    react: { useState: state, useRef: (current) => state({ current })[0], useEffect() {} },    '@/components/Modal': { default: 'Modal' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Select': { default: 'Select' },
    '@/lib/services/apiClient': { apiFetch: async (_url, options) => { const result = await request(options.method, JSON.parse(options.body)); return result ?? Response.json({}) } },
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
    alert: () => text(visit(tree).find((node) => node.props.role === 'alert')),
    control: (title) => visit(tree).find((node) => node.props.title === title),
  }
}

test('guardar usuario bloquea duplicados y recupera el formulario después de fallo y éxito', async () => {
  const modal = modalHarness('components/usuarios/UsuarioFormModal.tsx')
  const pending = modal.submit()
  const duplicate = modal.submit() // Segundo evento antes de renderizar el botón disabled.
  assert.equal(modal.requests.length, 1)
  await duplicate
  modal.close()
  assert.equal(modal.closes(), 0)
  modal.render()
  assert.equal(modal.button('Crear usuario').props.loading, true)
  modal.requests[0].reject(new TypeError('Failed to fetch'))
  await pending
  modal.render()
  assert.equal(modal.errors.length, 1)
  assert.match(modal.alert(), /conectar/ )
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
  const duplicate = modal.button('Eliminar').props.onClick()
  assert.equal(modal.requests.length, 1)
  await duplicate
  modal.requests[0].reject(new TypeError('Failed to fetch'))
  await pending; modal.render()
  assert.equal(modal.button('Eliminar').props.loading, false)
  assert.equal(modal.errors.length, 1)
})

test('reset conserva la contraseña tras un fallo y la limpia después del éxito', async () => {
  const modal = modalHarness('components/usuarios/ResetPasswordModal.tsx', { usuario: { id: 'otro', nombre: 'Otro' } })
  modal.button('Generar').props.onClick(); modal.render()
  const pending = modal.button('Guardar').props.onClick()
  const duplicate = modal.button('Guardar').props.onClick()
  modal.button('Regenerar').props.onClick()
  modal.control('Limpiar').props.onClick()
  modal.close()
  assert.equal(modal.requests.length, 1)
  await duplicate
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
  const { mutateUsuario } = loadModule('lib/services/usuariosService.ts', {
    '@tanstack/react-query': {},
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'local-test' } } }) } } },
  }, { fetch: async (_url, options) => {
    calls++
    assert.equal(options.headers.Authorization, 'Bearer local-test')
    return Response.json({ error: 'No se puede dejar el sistema sin administradores activos' }, { status: 409 })
  } })
  await assert.rejects(mutateUsuario('PATCH', { id: 'otro', estado: 'inactivo' }, 'No se pudo guardar'),
    (error) => error.status === 409 && /administradores/.test(error.message))
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
  assert.equal(validarUsuarioInput({ nombre: 'Persona', email: 'p@example.test', rol: 'coordinador' }, 'POST').error, 'Rol inválido')
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

test('un formulario incompleto no genera contraseña ni inicia una escritura', async () => {
  const modal = modalHarness('components/usuarios/UsuarioFormModal.tsx')
  await modal.submit({ nombre: '   ', email: 'persona@example.test', rol: 'colaborador', estado: 'activo' })
  assert.equal(modal.requests.length, 0)
  modal.render()
  assert.equal(modal.button('Crear usuario').props.loading, false)
  assert.match(modal.alert(), /campos obligatorios/)
})

test('guardar y eliminar comparten bloqueo hasta que termine la operación pendiente', async () => {
  const modal = modalHarness('components/usuarios/UsuarioFormModal.tsx', { mode: 'editar', usuario: { id: 'otro', nombre: 'Otro' } })
  modal.button('Eliminar').props.onClick(); modal.render()
  const pending = modal.button('Eliminar').props.onClick()
  await modal.submit()
  modal.close()
  assert.equal(modal.requests.length, 1)
  assert.equal(modal.closes(), 0)
  modal.requests[0].resolve()
  await pending; modal.render()
  const saving = modal.submit()
  assert.equal(modal.requests.length, 2)
  assert.equal(modal.requests[1].args[0], 'PATCH')
  modal.requests[1].resolve()
  await saving
})

test('el alta exitosa conserva la contraseña entregada aunque falle el callback de refresco', async () => {
  let saved
  const modal = modalHarness('components/usuarios/UsuarioFormModal.tsx', {
    onSuccess: async (result) => { saved = result; throw new TypeError('Failed to fetch') },
  })
  const pending = modal.submit()
  modal.requests[0].resolve()
  await pending; modal.render()
  assert.equal(modal.requests.length, 1)
  assert.equal(saved.tempPassword, modal.requests[0].args[1].password)
  assert.equal(modal.closes(), 1)
  assert.equal(modal.button('Crear usuario').props.loading, false)
  assert.match(modal.errors[0][1], /usuario se guardó.*listado/)
})

test('un reset escrito no se reenvía si falla el refresco y limpia el borrador', async () => {
  const modal = modalHarness('components/usuarios/ResetPasswordModal.tsx', {
    usuario: { id: 'otro', nombre: 'Otro' }, onSaved: async () => { throw new TypeError('Failed to fetch') },
  })
  modal.button('Generar').props.onClick(); modal.render()
  const pending = modal.button('Guardar').props.onClick()
  modal.requests[0].resolve()
  await pending; modal.render()
  assert.equal(modal.requests.length, 1)
  assert.equal(modal.closes(), 1)
  assert.ok(modal.button('Generar'))
  assert.match(modal.errors[0][1], /contraseña se actualizó.*listado/)
})

test('el servicio sanitiza errores HTTP y tolera respuestas de error sin JSON', async () => {
  for (const response of [
    Response.json({ error: 'SELECT secret FROM private_users' }, { status: 500 }),
    new Response('Invalid gateway response', { status: 502 }),
  ]) {
    let calls = 0
    const { mutateUsuario } = loadModule('lib/services/usuariosService.ts', {
      '@/lib/services/apiClient': { apiFetch: async () => { calls++; return response } },
    })
    await assert.rejects(mutateUsuario('DELETE', { id: 'otro' }, 'No se pudo eliminar'),
      (error) => error.status === response.status && error.message === 'El servicio no pudo completar la solicitud.')
    assert.equal(calls, 1)
  }
})

test('apiFetch cancela antes de leer la sesión y después de la espera Auth', async () => {
  let sessionReads = 0, fetchCalls = 0, resolveSession
  const { apiFetch } = loadModule('lib/services/apiClient.ts', {
    '@/lib/supabase': { supabase: { auth: { getSession: () => {
      sessionReads++
      return new Promise((resolve) => { resolveSession = resolve })
    } } } },
  }, { fetch: async () => { fetchCalls++; return Response.json({}) } })
  const before = new AbortController()
  before.abort()
  await assert.rejects(apiFetch('/api/usuarios', { signal: before.signal }), (error) => error.name === 'AbortError')
  assert.equal(sessionReads, 0)
  const during = new AbortController()
  const pending = apiFetch('/api/usuarios', { signal: during.signal })
  during.abort()
  resolveSession({ data: { session: { access_token: 'local-test' } } })
  await assert.rejects(pending, (error) => error.name === 'AbortError')
  assert.equal(sessionReads, 1)
  assert.equal(fetchCalls, 0)
})

test('apiFetch conserva signal, headers y opciones al moverlo fuera de useUsuarios', async () => {
  const signal = new AbortController().signal
  let calls = 0
  const { apiFetch } = loadModule('lib/queries/useUsuarios.ts', {
    '@tanstack/react-query': {},
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'local-test' } } }) } } },
  }, { fetch: async (url, options) => {
    calls++
    assert.equal(url, '/api/usuarios')
    assert.equal(options.signal, signal)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers.Authorization, 'Bearer local-test')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.headers['X-Test'], 'local')
    return new Response(null, { status: 204 })
  } })
  const response = await apiFetch('/api/usuarios', { method: 'PATCH', headers: { 'X-Test': 'local' }, signal })
  assert.equal(response.status, 204)
  assert.equal(calls, 1)
})


test('Usuario conserva nombres FormData y asocia etiquetas al usar controles compartidos', () => {
  for (const [esAuto, operation] of [[false, null], [true, null], [false, 'guardar']]) {
    const { default: Form } = loadModule('components/usuarios/UsuarioFormModal.tsx', {
      react: { ...React, useState: initial => [initial, () => {}] },
      '@/components/Modal': { default: ({ children }) => children },
      '@/lib/hooks/useOperationLock': { useOperationLock: () => ({
        operation, isLocked: () => operation !== null, begin: () => false, finish() {},
      }) },
      '@/lib/services/usuariosService': { mutateUsuario() { throw new Error('No debe escribir al renderizar') } },
      '@/lib/services/errorToast': { showError() {}, showSuccess() {} },
    })
    const html = renderToStaticMarkup(Form({ open: true, mode: 'editar', esAuto,
      usuario: { id: 'fixture-user', nombre: 'Nombre sintético', email: 'fixture@example.test', rol: 'admin', estado: 'activo' },
      onClose() {}, onSuccess() {}, onDelete() {},
    }))
    for (const [name, id] of [['nombre', 'usuario-nombre'], ['email', 'usuario-email'], ['rol', 'usuario-rol'], ['estado', 'usuario-estado']]) {
      assert.match(html, new RegExp('<label[^>]*for="' + id + '"'))
      const control = html.match(new RegExp('<(?:input|select)\\b[^>]*\\bid="' + id + '"[^>]*>'))[0]
      assert.ok(control.includes('name="' + name + '"'))
      assert.ok(control.includes('required=""'))
      assert.equal(control.includes('disabled=""'), operation !== null || (esAuto && ['rol', 'estado'].includes(name)))
    }
    assert.match(html, /<button[^>]*type="submit"/)
  }
})
