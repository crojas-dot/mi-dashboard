import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, fakeDatabase } from './load-module.mjs'

function navigation(permisos, id = 'perfil-propio') {
  const db = fakeDatabase({ quejas: [{ id: 'propia', responsable_id: id, fecha: '2026-10-06' }, { id: 'ajena', responsable_id: 'otro', fecha: '2026-10-06' }] })
  const preloads = []
  const Sidebar = loadModule('components/Sidebar.tsx', {
    'next/link': { default: 'a' },
    'next/navigation': { usePathname: () => '/mis-quejas' },
    '@/lib/supabase': db,
    '@/lib/store/sidebar-store': { useSidebarStore: () => ({ collapsed: false, toggle() {} }) },
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ user: { id, rol: 'colaborador' }, permisos }) },
    '@/hooks/useHoverPrefetch': { useHoverPrefetch: () => config => preloads.push(config) },
  }).default
  const visit = element => Array.isArray(element) ? element.flatMap(visit) : element?.props ? [element, ...visit(element.props.children)] : []
  return { links: visit(Sidebar()).filter(element => element.type === 'a'), preloads, calls: db.calls }
}

test('hover, foco y tacto precargan Mis Quejas con la misma clave y el responsable propio', async () => {
  const fixture = navigation([{ modulo: 'mis_quejas', leer: true, escribir: false }])
  const link = fixture.links.find(element => element.props.href === '/mis-quejas')
  for (const event of ['onMouseEnter', 'onFocus', 'onTouchStart']) link.props[event]()
  assert.equal(fixture.preloads.length, 3)
  for (const config of fixture.preloads) {
    assert.equal(config.queryKey[1].responsableId, 'perfil-propio')
    assert.deepEqual((await config.queryFn({ signal: new AbortController().signal, queryKey: config.queryKey })).data.map(row => row.id), ['propia'])
  }
  assert.equal(new Set(fixture.preloads.map(config => JSON.stringify(config.queryKey))).size, 1)
})

test('la precarga respeta enlaces permitidos y no convierte una identidad ausente en consulta general', () => {
  const fixture = navigation([{ modulo: 'mis_quejas', leer: true, escribir: false }], null)
  assert.equal(fixture.links.some(element => element.props.href === '/quejas'), false)
  assert.equal(fixture.links.some(element => element.props.href === '/usuarios'), false)
  const link = fixture.links.find(element => element.props.href === '/mis-quejas')
  link.props.onFocus()
  link.props.onTouchStart()
  assert.equal(fixture.preloads.length, 0)
  assert.equal(fixture.calls.length, 0)
})
