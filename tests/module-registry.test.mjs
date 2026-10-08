import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const registry = loadModule('lib/constants/modulos.ts')
const permisos = loadModule('lib/permisos.ts')
const roles = loadModule('lib/constants/roles.ts')
const { authRoute } = loadModule('lib/authRoute.ts')
const clone = value => JSON.parse(JSON.stringify(value))

test('cada ruta del registro conserva identidad, título exacto y permiso por primer segmento', () => {
  const ids = Object.keys(registry.MODULOS)
  const paths = Object.values(registry.MODULOS).map(modulo => modulo.ruta)
  assert.equal(ids.length, 12)
  assert.equal(new Set(paths).size, ids.length)
  for (const [id, modulo] of Object.entries(registry.MODULOS)) {
    assert.equal(permisos.moduloDeRuta(modulo.ruta), id)
    assert.equal(registry.tituloDeRuta(modulo.ruta), modulo.label)
    if (modulo.ruta !== '/') {
      assert.equal(permisos.moduloDeRuta(modulo.ruta + '/registro'), id)
      assert.equal(registry.tituloDeRuta(modulo.ruta + '/registro'), 'QMS')
      assert.equal(permisos.moduloDeRuta(modulo.ruta + '-falso'), '')
    }
  }
  for (const path of ['/login', '/q/publico', '/desconocido']) {
    assert.equal(permisos.moduloDeRuta(path), '')
    assert.equal(registry.tituloDeRuta(path), 'QMS')
  }
})

test('menú y matriz incluyen cada módulo una vez y conservan sus distintos órdenes', () => {
  const navigationIds = registry.GRUPOS_NAVEGACION.flatMap(group => group.modulos)
  const permissionIds = registry.MODULOS_PERMISOS.map(modulo => modulo.key)
  assert.deepEqual(new Set(navigationIds), new Set(Object.keys(registry.MODULOS)))
  assert.equal(navigationIds.length, new Set(navigationIds).size)
  assert.deepEqual(clone(navigationIds.slice(-3)), ['usuarios', 'reporteria', 'configuracion'])
  assert.deepEqual(clone(permissionIds.slice(-3)), ['usuarios', 'configuracion', 'reporteria'])
  for (const modulo of registry.MODULOS_PERMISOS) assert.equal(modulo.label, registry.MODULOS[modulo.key].label)
})

test('usar metadatos compartidos conserva lectura, escritura, excepción admin y bloqueo de sesión', () => {
  const current = { initialized: true, loading: false, user: { rol: 'colaborador' }, permisos: [] }
  for (const [id, modulo] of Object.entries(registry.MODULOS)) {
    assert.equal(authRoute(modulo.ruta, { ...current, user: null }).redirect, '/login')
    assert.equal(authRoute(modulo.ruta, current).view, 'denied')
    const grants = [{ rol: 'colaborador', modulo: id, leer: true, escribir: false }]
    assert.equal(authRoute(modulo.ruta, { ...current, permisos: grants }).view, 'private')
    assert.equal(permisos.tienePermiso(grants, id, false, 'colaborador'), true)
    assert.equal(permisos.tienePermiso(grants, id, true, 'colaborador'), false)
    assert.equal(permisos.tienePermiso([], id, false, 'admin'), id === 'configuracion')
  }
  assert.equal(authRoute('/ruta-sin-mapeo', current).view, 'private', 'una ruta no registrada mantiene el guard de sesión existente')
  assert.equal(authRoute('/login-falso', { ...current, user: null }).redirect, '/login')
  assert.equal(authRoute('/q-falso', { ...current, user: null }).redirect, '/login')
})

test('IA conserva su alcance explícito y etiquetas sin admitir módulos nuevos del menú', () => {
  const { normalizeRouting } = loadModule('lib/server/aiSettings.ts')
  assert.deepEqual(clone(registry.MODULOS_IA.map(modulo => modulo.id)), ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'revision', 'general'])
  assert.equal(registry.MODULOS_IA.find(modulo => modulo.id === 'sacp').label, 'SACP (Acciones)')
  assert.equal(registry.MODULOS_IA.find(modulo => modulo.id === 'revision').label, 'Revisión Dirección')
  for (const { id } of registry.MODULOS_IA) {
    const route = { [id]: { proveedor_id: 'fixture', modelo_nombre: 'fixture-model' } }
    assert.equal(registry.esModuloIA(id), true)
    assert.deepEqual(clone(normalizeRouting(route)), route)
  }
  for (const value of ['dashboard', 'usuarios', 'procesos', 'configuracion', 'reporteria', 'desconocido', null, 123, {}]) {
    assert.equal(registry.esModuloIA(value), false)
    if (typeof value === 'string') assert.throws(() => normalizeRouting({ [value]: { proveedor_id: 'fixture', modelo_nombre: 'fixture-model' } }))
  }
})

test('los roles gestionables comparten orden y etiquetas sin ampliar la lista permitida', () => {
  assert.deepEqual(clone(roles.ROLES_GESTIONABLES), ['admin', 'calidad', 'colaborador'])
  assert.deepEqual(clone(roles.ROLES_GESTIONABLES.map(roles.getRoleLabel)), ['Administrador', 'Calidad', 'Colaborador'])
  for (const role of roles.ROLES_GESTIONABLES) assert.equal(roles.esRolGestionable(role), true)
  for (const role of ['coordinador', 'revisor', 'usuario', 'desconocido', null]) {
    assert.equal(roles.esRolGestionable(role), false)
  }
})

test('Sidebar consume rutas, títulos y orden del registro sin precargar durante render', () => {
  const { default: Sidebar } = loadModule('components/Sidebar.tsx', {
    'next/link': { default: 'a' },
    'next/navigation': { usePathname: () => '/quejas' },
    '@/lib/supabase': { supabase: {} },
    '@/lib/store/sidebar-store': { useSidebarStore: () => ({ collapsed: false, toggle() {} }) },
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ user: { id: 'fixture', rol: 'colaborador' }, permisos: registry.MODULOS_PERMISOS.map(modulo => ({ modulo: modulo.key, leer: true, escribir: false })) }) },
    '@/hooks/useHoverPrefetch': { useHoverPrefetch: () => () => { throw new Error('No precargar durante render') } },
  })
  const visit = element => Array.isArray(element) ? element.flatMap(visit) : element?.props ? [element, ...visit(element.props.children)] : []
  const links = visit(Sidebar()).filter(element => element.type === 'a' && element.props['aria-label'])
  assert.deepEqual(clone(links.map(link => link.props.href)), clone(registry.GRUPOS_NAVEGACION.flatMap(group => group.modulos.map(id => registry.MODULOS[id].ruta))))
  assert.deepEqual(clone(links.map(link => link.props['aria-label'])), clone(registry.GRUPOS_NAVEGACION.flatMap(group => group.modulos.map(id => registry.MODULOS[id].label))))
  assert.equal(links.find(link => link.props.href === '/quejas').props['aria-current'], 'page')
})
