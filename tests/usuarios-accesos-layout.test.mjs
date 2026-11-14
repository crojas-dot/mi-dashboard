import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const users = fs.readFileSync('app/usuarios/page.tsx', 'utf8')
const settings = fs.readFileSync('app/configuracion/page.tsx', 'utf8')
const matrix = fs.readFileSync('app/usuarios/components/RolesAccesos.tsx', 'utf8')
const form = fs.readFileSync('components/usuarios/UsuarioFormModal.tsx', 'utf8')
const reset = fs.readFileSync('components/usuarios/ResetPasswordModal.tsx', 'utf8')

test('roles y permisos vive en Usuarios y no en Configuración', () => {
  assert.match(users, /Roles y permisos/)
  assert.match(users, /<RolesAccesos active/)
  assert.match(users, /role="tablist"/)
  assert.doesNotMatch(settings, /import RolesAccesos|id: 'roles'/)
  assert.match(matrix, /usePermisos\(active\)/)
  assert.match(matrix, /useActualizarPermiso\(\)/)
})

test('la matriz conserva los dos permisos reales y las restricciones del administrador', () => {
  assert.match(matrix, /sin: \{ leer: false, escribir: false \}/)
  assert.match(matrix, /lectura: \{ leer: true, escribir: false \}/)
  assert.match(matrix, /edicion: \{ leer: true, escribir: true \}/)
  assert.match(matrix, /modulo === 'configuracion'/)
  assert.match(matrix, /modulo === 'usuarios' && rol !== 'admin'/)
  assert.match(matrix, /await actualizar.mutateAsync\(siguiente\)/)
  assert.doesNotMatch(matrix, /Guardar cambios/)
})

test('perfil conserva guardados reales y seguridad no simula funciones ausentes', () => {
  assert.match(users, /onResetPassword=\{restablecerDesdePerfil\}/)
  assert.match(form, /Seguridad y acceso/)
  assert.match(form, /await mutateUsuario\('PATCH'/)
  assert.match(form, /await mutateUsuario\('POST'/)
  assert.match(reset, /newPassword: password/)
  assert.match(form, /Aún no se puede establecer una contraseña manual/)
  assert.match(form, /Aún no se pueden enviar correos de recuperación/)
  assert.match(form, /La función 2FA aún no está disponible/)
  assert.doesNotMatch(form, /updateFactor|sendEmail|resendInvitation/)
})
