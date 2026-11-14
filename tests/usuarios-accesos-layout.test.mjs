import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadModule } from './load-module.mjs'

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

test('cambiar nivel usa el upsert existente y respeta módulos reservados sin escribir', async () => {
  const writes = [], notices = []
  const permisos = [{ rol: 'calidad', modulo: 'quejas', leer: true, escribir: false }]
  const { default: RolesAccesos } = loadModule('app/usuarios/components/RolesAccesos.tsx', {
    react: { useRef: initial => ({ current: initial }) },
    '@/components/ui/LoadingSkeleton': { default: 'LoadingSkeleton' },
    '@/components/ui/ErrorState': { default: 'ErrorState' },
    '@/components/ui/Select': { default: 'Select' },
    '@/lib/queries/usePermisos': {
      usePermisos: () => ({ data: permisos, isLoading: false, error: null }),
      useActualizarPermiso: () => ({ isPending: false, mutateAsync: async data => { writes.push(data) } }),
    },
    '@/lib/constants/modulos': { MODULOS_PERMISOS: [
      { key: 'quejas', label: 'Quejas' }, { key: 'usuarios', label: 'Usuarios' }, { key: 'configuracion', label: 'Configuración' },
    ] },
    '@/lib/constants/roles': {
      ROLES_GESTIONABLES: ['admin', 'calidad', 'colaborador'],
      getRoleLabel: rol => ({ admin: 'Administrador', calidad: 'Calidad', colaborador: 'Colaborador' })[rol],
    },
    '@/lib/services/errorToast': { showSuccess: msg => notices.push(msg), showError: () => { throw Error('No se esperaba error') } },
  })
  const tree = RolesAccesos({ active: true })
  const visit = node => Array.isArray(node) ? node.flatMap(visit) : node?.props ? [node, ...visit(node.props.children)] : []
  const cell = label => visit(tree).find(node => node.type === 'Select' && node.props['aria-label'] === label)
  assert.equal(cell('Quejas para Calidad').props.value, 'lectura')
  cell('Quejas para Calidad').props.onChange({ target: { value: 'edicion' } })
  await new Promise(setImmediate)
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ rol: 'calidad', modulo: 'quejas', leer: true, escribir: true }])
  assert.deepEqual(notices, ['Permiso actualizado'])
  assert.equal(cell('Configuración para Calidad').props.disabled, true)
  cell('Configuración para Calidad').props.onChange({ target: { value: 'edicion' } })
  cell('Usuarios para Colaborador').props.onChange({ target: { value: 'edicion' } })
  cell('Quejas para Calidad').props.onChange({ target: { value: 'administracion' } })
  await new Promise(setImmediate)
  assert.equal(writes.length, 1, 'no se escriben roles reservados ni administración ajena')
})

test('la ayuda no ocupa espacio permanente y la matriz tiene desplazamiento propio', () => {
  assert.match(matrix, /aria-label="Ayuda sobre niveles de acceso"/)
  assert.match(matrix, /<details className="group relative z-20">/)
  assert.match(matrix, /data-users-permissions-scroll/)
  assert.match(matrix, /sticky top-0 z-20/)
  assert.match(users, /data-users-pagination/)
  assert.match(users, /containerClassName="h-full min-h-0 overflow-auto overscroll-contain"/)
  assert.match(form, /data-user-editor-scroll/)
  assert.match(form, /size="mail" variant="document" height="fill"/)
  assert.match(form, /hidden=\{tab !== 'detalles'\}/)
  assert.match(form, /hidden=\{tab !== 'seguridad'\}/)
})

test('directorio y matriz comparten un único lienzo con herramientas arriba y scroll propio', () => {
  assert.match(users, /data-users-directory/)
  assert.match(users, /className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b/)
  assert.match(users, /aria-label="Buscar y filtrar usuarios"/)
  assert.match(users, /data-users-pagination/)
  assert.match(matrix, /data-users-permissions-scroll/)
  assert.doesNotMatch(matrix, /ui-panel flex min-h-0 flex-1/)
})
