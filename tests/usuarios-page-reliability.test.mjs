import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const actor = { id: 'actor', rol: 'admin', nombre: 'Administración' }
const other = { id: 'other', rol: 'calidad', nombre: 'Persona de prueba', email: 'persona@example.test', estado: 'activo' }
const clone = value => JSON.parse(JSON.stringify(value))
const settle = () => new Promise(setImmediate)

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function pageHarness({ user = actor, initialized = true, refresh = async () => {}, rows = [other] } = {}) {
  const slots = [], effects = [], requests = [], invalidations = [], successes = [], errors = [], redirects = [], queryCalls = []
  let cursor = 0, tree
  const useState = initial => {
    const index = cursor++
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
  }
  const mocks = {
    react: { useState, useRef: current => useState({ current })[0], useDeferredValue: value => value, useEffect: callback => effects.push(callback) },
    'next/navigation': { useRouter: () => ({ replace: path => redirects.push(path) }) },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: (...args) => { invalidations.push(args); return refresh() } }) },
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ user, initialized }) },
    '@/lib/queries/useUsuarios': { usuariosKey: ['usuarios'], useUsuarios: (...args) => { queryCalls.push(args); return { data: rows, isLoading: false, isError: false } } },
    '@/lib/services/usuariosService': { mutateUsuario: (...args) => {
      const pending = deferred()
      requests.push({ args, ...pending })
      return pending.promise
    } },
    '@/lib/services/errorToast': { showSuccess: message => successes.push(message), showError: (error, fallback) => errors.push({ error, fallback }) },
    './components/RolesAccesos': { default: 'RolesAccesos' },
    './components/UsuarioAccionesMenu': { default: 'UserActionsMenu' },
    '@/components/ui/Table': { Table: 'Table', TableHead: 'TableHead', TableHeaderCell: 'TableHeaderCell', TableRow: 'TableRow', TableCell: 'TableCell' },
  }
  for (const name of ['LoadingSkeleton', 'PageHeader', 'Badge', 'EmptyState', 'Button', 'Select']) mocks['@/components/ui/' + name] = { default: name }
  for (const name of ['UsuarioFormModal', 'ConfirmDialog']) mocks['@/components/usuarios/' + name] = { default: name }
  const { default: Page } = loadModule('app/usuarios/page.tsx', mocks)
  const visit = element => Array.isArray(element) ? element.flatMap(visit) : element?.props ? [element, ...visit(element.props.children)] : []
  const text = element => Array.isArray(element) ? element.map(text).join(' ') : element?.props ? text(element.props.children) : typeof element === 'string' ? element : ''
  function render() { cursor = 0; effects.length = 0; tree = Page(); return tree }
  function component(type) { return visit(tree).find(node => node.type === type) }
  function button(label, rowId) {
    const subtree = rowId ? visit(tree).find(node => node.type === 'TableRow' && node.key === rowId) : tree
    const found = visit(subtree).find(node => node.type === 'Button' && text(node).trim() === label)
    if (found) return found
    const menu = visit(subtree).find(node => node.type === 'UserActionsMenu')
    if (menu) {
      const action = { Gestionar: 'onEditar', Resetear: 'onRestablecer', Desactivar: 'onEstado', Restaurar: 'onEstado' }[label]
      const expected = menu.props.usuario.estado === 'activo' ? 'Desactivar' : 'Restaurar'
      assert.ok(action && (label === 'Gestionar' || label === 'Resetear' || label === expected), 'Acción ' + label)
      const disabled = label === 'Desactivar' && menu.props.esPropio
      return { props: { disabled, onClick: disabled ? () => {} : menu.props[action] } }
    }
    assert.fail('Botón ' + label)
  }
  render()
  return { render, component, button, requests, invalidations, successes, errors, redirects, queryCalls,
    rowIds: () => visit(tree).filter(node => node.type === 'TableRow').map(node => node.key),
    select: label => visit(tree).find(node => node.type === 'Select' && node.props['aria-label'] === label),
    runEffects: () => effects.forEach(effect => effect()) }
}

function assertRefreshCall(page) {
  assert.equal(page.invalidations.length, 1)
  assert.deepEqual(clone(page.invalidations[0]), [{ queryKey: ['usuarios'] }, { throwOnError: true }])
}

test('el guard real no presenta filas ni controles de administración sin un admin inicializado', () => {
  for (const state of [{ initialized: false }, { user: null }, { user: { id: 'calidad', rol: 'calidad' } }]) {
    const page = pageHarness(state)
    assert.equal(page.component('Table'), undefined)
    assert.equal(page.queryCalls.at(-1)[1], false)
    assert.equal(page.component('UsuarioFormModal'), undefined)
    assert.equal(page.component('ConfirmDialog'), undefined)
    assert.equal(page.component('LoadingSkeleton').props.label, 'Verificando acceso…')
    page.runEffects()
    assert.deepEqual(page.redirects, state.initialized === false ? [] : ['/'])
    assert.equal(page.requests.length, 0)
  }
})

test('el alta conserva el modal activo para copiar la contraseña y no crea una segunda ventana', async () => {
  const refresh = deferred()
  const page = pageHarness({ refresh: () => refresh.promise })
  page.button('Nuevo usuario').props.onClick(); page.render()
  const pending = page.component('UsuarioFormModal').props.onSuccess({ tempPassword: 'Synthetic-Password-123' })
  page.render()
  assert.equal(page.component('UsuarioFormModal').props.open, true)
  assert.equal(page.component('UsuarioFormModal').props.usuario, null)
  assert.equal(page.component('PasswordModal'), undefined)
  assert.equal(page.component('ResetPasswordModal'), undefined)
  assertRefreshCall(page)
  const failure = new TypeError('Failed to fetch')
  refresh.reject(failure)
  await assert.rejects(pending, error => error === failure)
  page.render()
  assert.equal(page.component('UsuarioFormModal').props.open, true)
  assert.equal(page.requests.length, 0, 'el refresco no vuelve a crear el usuario')
})

test('un borrado rechazado conserva la selección y propaga el error al modal sin fingir éxito', async () => {
  const page = pageHarness()
  page.button('Gestionar', other.id).props.onClick(); page.render()
  const pending = page.component('UsuarioFormModal').props.onDelete(other)
  assert.equal(page.requests.length, 1)
  assert.deepEqual(clone(page.requests[0].args.slice(0, 2)), ['DELETE', { id: other.id }])
  const failure = Object.assign(new Error('No se puede eliminar este usuario'), { status: 409 })
  page.requests[0].reject(failure)
  await assert.rejects(pending, error => error === failure && error.status === 409)
  page.render()
  assert.equal(page.component('UsuarioFormModal').props.open, true)
  assert.equal(page.component('UsuarioFormModal').props.usuario.id, other.id)
  assert.equal(page.invalidations.length, 0)
  assert.equal(page.successes.length, 0)
  assert.equal(page.errors.length, 0, 'el modal es quien presenta el fallo de escritura')
})

test('un borrado escrito termina aunque falle el refresco y muestra el fallo del listado por separado', async () => {
  const page = pageHarness({ refresh: async () => { throw new TypeError('Failed to fetch') } })
  page.button('Gestionar', other.id).props.onClick(); page.render()
  const pending = page.component('UsuarioFormModal').props.onDelete(other)
  page.requests[0].resolve()
  await pending; page.render()
  assert.equal(page.component('UsuarioFormModal').props.open, false)
  assert.equal(page.component('UsuarioFormModal').props.usuario, null)
  assert.equal(page.requests.length, 1)
  assert.deepEqual(page.successes, ['Usuario eliminado'])
  assert.match(page.errors[0].fallback, /usuario se eliminó.*listado/)
  assert.equal(page.errors[0].error, null)
  assertRefreshCall(page)
})

test('la propia cuenta no inicia borrado ni cambio de estado aunque se invoque el callback', async () => {
  const own = { ...other, ...actor }
  const page = pageHarness({ rows: [own] })
  page.button('Gestionar', own.id).props.onClick(); page.render()
  await assert.rejects(page.component('UsuarioFormModal').props.onDelete(own), /propia cuenta/)
  const disable = page.button('Desactivar', own.id)
  assert.equal(disable.props.disabled, true)
  disable.props.onClick(); page.render()
  assert.equal(page.component('ConfirmDialog').props.open, false)
  assert.equal(page.requests.length, 0)
  assert.equal(page.invalidations.length, 0)
})

test('confirmar estado bloquea doble evento y cierre, conserva el diálogo si falla y permite reintentar', async () => {
  const page = pageHarness()
  page.button('Desactivar', other.id).props.onClick(); page.render()
  const dialog = page.component('ConfirmDialog')
  const pending = dialog.props.onConfirm()
  await dialog.props.onConfirm()
  dialog.props.onCancel(); page.render()
  assert.equal(page.requests.length, 1)
  assert.equal(page.component('ConfirmDialog').props.open, true)
  assert.equal(page.component('ConfirmDialog').props.loading, true)
  const failure = Object.assign(new Error('Conflicto de actualización'), { status: 409 })
  page.requests[0].reject(failure)
  await pending; page.render()
  assert.equal(page.component('ConfirmDialog').props.open, true)
  assert.equal(page.component('ConfirmDialog').props.loading, false)
  assert.equal(page.errors[0].error, failure)
  assert.equal(page.invalidations.length, 0)
  assert.equal(page.successes.length, 0)
  const retry = page.component('ConfirmDialog').props.onConfirm()
  assert.equal(page.requests.length, 2)
  assert.deepEqual(clone(page.requests[1].args.slice(0, 2)), ['PATCH', { id: other.id, estado: 'inactivo' }])
  page.requests[1].resolve()
  await retry; page.render()
  assert.equal(page.component('ConfirmDialog').props.open, false)
  assert.equal(page.component('ConfirmDialog').props.loading, false)
  assert.deepEqual(page.successes, ['Usuario desactivado'])
  assertRefreshCall(page)
})

test('activar o desactivar mantiene el bloqueo hasta el refresco y no repite una escritura exitosa', async () => {
  for (const [estado, button, saved, message] of [['activo', 'Desactivar', 'inactivo', 'Usuario desactivado'], ['inactivo', 'Restaurar', 'activo', 'Usuario activado']]) {
    const refresh = deferred()
    const page = pageHarness({ rows: [{ ...other, estado }], refresh: () => refresh.promise })
    page.button(button, other.id).props.onClick(); page.render()
    const previous = page.component('ConfirmDialog')
    const pending = previous.props.onConfirm()
    page.requests[0].resolve()
    await settle(); page.render()
    assert.equal(page.component('ConfirmDialog').props.open, false)
    assert.equal(page.component('ConfirmDialog').props.loading, true)
    await previous.props.onConfirm()
    assert.equal(page.requests.length, 1)
    assert.deepEqual(clone(page.requests[0].args.slice(0, 2)), ['PATCH', { id: other.id, estado: saved }])
    assert.deepEqual(page.successes, [message])
    refresh.reject(new TypeError('Failed to fetch'))
    await pending; page.render()
    assert.equal(page.component('ConfirmDialog').props.loading, false)
    await page.component('ConfirmDialog').props.onConfirm()
    assert.equal(page.requests.length, 1)
    assert.equal(page.errors.length, 1)
    assert.match(page.errors[0].fallback, /estado se guardó.*listado/)
    assert.equal(page.errors[0].error, null)
    assertRefreshCall(page)
  }
})

test('la opción Restablecer abre Seguridad y acceso en el mismo modal', async () => {
  const failure = new TypeError('Failed to fetch')
  const page = pageHarness({ refresh: async () => { throw failure } })
  page.button('Resetear', other.id).props.onClick(); page.render()
  const form = page.component('UsuarioFormModal')
  assert.equal(form.props.mode, 'editar')
  assert.equal(form.props.usuario.id, other.id)
  assert.equal(form.props.initialTab, 'seguridad')
  assert.equal(form.props.open, true)
  assert.equal(page.component('ResetPasswordModal'), undefined)
  await assert.rejects(form.props.onPasswordSaved(), error => error === failure)
  assertRefreshCall(page)
  assert.equal(page.requests.length, 0)
})

test('Gestión de accesos conserva Usuarios y Roles con reinicio de estado al abrir', () => {
  const page = pageHarness()
  const markup = page.render()
  const tabs = []
  const visit = value => Array.isArray(value) ? value.forEach(visit) : value?.props ? (value.props.role === 'tab' && tabs.push(value), visit(value.props.children)) : undefined
  visit(markup)
  assert.deepEqual(tabs.map(tab => tab.props.children), ['Usuarios', 'Roles y permisos'])
  assert.equal(page.component('UsuarioFormModal'), undefined)
  page.button('Gestionar', other.id).props.onClick()
  page.render()
  assert.equal(page.component('UsuarioFormModal').props.initialTab, 'detalles')
  page.component('UsuarioFormModal').props.onClose()
  page.render()
  assert.equal(page.component('UsuarioFormModal'), undefined)
  page.button('Resetear', other.id).props.onClick()
  page.render()
  assert.equal(page.component('UsuarioFormModal').props.initialTab, 'seguridad')
})

test('paginación respeta filtros, evita páginas inexistentes y muestra el contador', () => {
  const rows = Array.from({length: 27}, (_, i) => ({ ...other, id: 'persona-' + i, nombre: 'Persona ' + i }))
  const page = pageHarness({ rows })
  assert.deepEqual(page.rowIds(), rows.slice(0,10).map(row => row.id))
  page.button('Siguiente').props.onClick()
  page.render()
  assert.deepEqual(page.rowIds(), rows.slice(10,20).map(row => row.id))
  page.select('Usuarios por página').props.onChange({ target: { value: '20' } })
  page.render()
  assert.deepEqual(page.rowIds(), rows.slice(0,20).map(row => row.id))
  assert.equal(page.button('Anterior').props.disabled, true)
  assert.equal(page.button('Siguiente').props.disabled, false)
})
