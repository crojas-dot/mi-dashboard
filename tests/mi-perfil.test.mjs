import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isValidElement } from 'react'
import { loadModule } from './load-module.mjs'

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement(node)) return []
  return [node, ...elements(node.props.children)]
}
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' ? node : ''

function userMenuFixture({ open = true } = {}) {
  const { default: UserMenuDropdown } = loadModule('components/header/UserMenuDropdown.tsx', {
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ user: { id: 'test-user', nombre: 'Persona', email: 'persona@example.test', rol: 'admin' } }) },
    '@/lib/constants/roles': { getRoleLabel: rol => rol, getRoleVariant: () => 'admin' },
  })
  const user = { id: 'test-user', nombre: 'Persona', email: 'persona@example.test', rol: 'admin' }
  const element = UserMenuDropdown({ open, user, initials: 'PE', onToggle() {}, onProfile() {}, onLogout() {} })
  const actions = elements(element).filter(node => node.type === 'button' && typeof node.props.onClick === 'function')
  const labels = actions.map(node => text(node)).filter(Boolean)
  return { element, actions, labels }
}

test('el menú de cuenta ofrece solo Mi perfil y Cerrar sesión', () => {
  const { actions, labels } = userMenuFixture()
  assert.ok(labels.includes('Mi perfil'), 'el menú debe ofrecer «Mi perfil»')
  assert.ok(labels.includes('Cerrar sesión'), 'el menú debe ofrecer «Cerrar sesión»')
  assert.ok(!labels.some(label => /contrase|preferencia|notificacion/i.test(label)), 'el menú no puede ofrecer más acciones de cuenta')
  const perfil = actions.find(node => text(node) === 'Mi perfil')
  const sesion = actions.find(node => text(node) === 'Cerrar sesión')
  assert.equal(typeof perfil.props.onClick, 'function')
  assert.equal(typeof sesion.props.onClick, 'function')
})

test('el menú cerrado solo deja el disparador del avatar', () => {
  const { actions } = userMenuFixture({ open: false })
  assert.equal(actions.length, 1)
})

test('el modal personal agrupa nombre, contraseña y preferencias de notificación', () => {
  const source = fs.readFileSync('components/perfil/MiPerfilModal.tsx', 'utf8')
  assert.ok(source.includes('id="mi-perfil-panel-detalles"'), 'la pestaña de detalles debe ser su propio panel con id de formulario')
  assert.ok(source.includes('Detalles del perfil'))
  assert.ok(source.includes('Seguridad'))
  assert.ok(source.includes('Notificaciones'))
  assert.ok(source.includes("supabase.from('usuarios').update({ nombre: nombreLimpio })"), 'el nombre se guarda con la autoedición RLS del propio usuario')
  assert.ok(source.includes('cambiarClavePerfil(token, nueva)'), 'la contraseña se actualiza con la sesión capturada')
  assert.ok(source.includes('actualizar_mis_preferencias_notificacion'), 'las preferencias conservan su RPC personal')
  assert.ok(source.includes('guardarPrefs'), 'las preferencias se guardan con guardado y rollback en el modal')
})

test('Mi perfil ofrece cambio de clave temporal manual o generada, con ojo y copiar', () => {
  const profile = fs.readFileSync('components/perfil/MiPerfilModal.tsx', 'utf8')
  const header = fs.readFileSync('components/Header.tsx', 'utf8')
  assert.ok(profile.includes('generatePassword(20)'))
  assert.ok(profile.includes('setConfirmacion(valor)'))
  assert.ok(profile.includes('setClaveVisible(true)'))
  assert.ok(profile.includes('navigator.clipboard.writeText(nueva)'))
  assert.ok(profile.includes('accessAction({ action: \'password\', password: nueva, confirmation: confirmacion })'))
  assert.ok(profile.includes('await refreshAccess()'))
  assert.ok(header.includes("setPerfilTab('seguridad')"))
  assert.ok(header.includes('Más tarde'))
  assert.ok(header.includes('temporaryPasswordExpiresAt'))
})

test('el encabezado ya no monta el modal de contraseña del menú', () => {
  const source = fs.readFileSync('components/Header.tsx', 'utf8')
  assert.ok(!source.includes('CambiarMiPasswordModal'))
  assert.ok(source.includes('MiPerfilModal'))
  assert.ok(source.includes('onProfile'))
})
