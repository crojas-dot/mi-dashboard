import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'
import { loadModule } from './load-module.mjs'

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement(node)) return []
  return [node, ...elements(node.props.children)]
}

function sidebarFixture({ pathname = '/quejas', mobile = false, collapsed = false, permisos = [{ modulo: 'quejas', leer: true }], rol = 'colaborador' } = {}) {
  const preloads = []
  const clicks = []
  const document = { activeElement: null }
  const state = { collapsed, hidden: false, mobileOpen: false, expandedGroups: {},
    toggleCollapsed: () => clicks.push('collapsed'), setMobileOpen: (value) => clicks.push(value),
    setGroupOpen: (key, value) => clicks.push([key, value]) }
  const mocks = {
    react: { ...React, memo: (component) => component, useEffect() {}, useRef: () => ({ current: null }) },
    'next/link': { default: 'a' }, 'next/navigation': { usePathname: () => pathname },
    '@/hooks/useMobileNavigation': { useMobileNavigation: () => mobile },
    '@/hooks/useHoverPrefetch': { useHoverPrefetch: () => config => preloads.push(config) },
    '@/lib/store/sidebar-store': { useSidebarStore: (selector) => selector ? selector(state) : state },
    '@/lib/store/auth-store': { useAuthStore: (selector) => selector({ user: { rol }, permisos }) },
    '@/lib/queries/pagination': { paginaKey: key => [...key, 0, 25] },
  }
  const queryModules = {
    useQuejas: { fetchQuejas: () => Promise.resolve([]), quejasKey: () => ['quejas'] },
    useDocumentos: { fetchDocumentos() {}, documentosKey: ['documentos'] },
    useSACP: { fetchAcciones() {}, accionesKey: ['acciones'] },
    useRiesgos: { fetchRiesgos() {}, riesgosKey: ['riesgos'] },
    useAuditorias: { fetchAuditorias() {}, auditoriasKey: ['auditorias'] },
    useReuniones: { fetchReuniones() {}, reunionesKey: ['reuniones'] },
    useProcesos: { fetchProcesos() {}, procesosKey: ['procesos'] },
    useUsuarios: { fetchUsuariosDirect() {}, usuariosQueryKey: () => ['usuarios'] },
    useDashboard: { fetchDashboard() {}, dashboardKey: ['dashboard'] },
  }
  for (const [name, exports] of Object.entries(queryModules)) mocks[`@/lib/queries/${name}`] = exports
  const { default: Sidebar } = loadModule('components/Sidebar.tsx', mocks, { document })
  return { element: Sidebar(), preloads, clicks, state, document }
}

test('Sidebar conserva permisos, ruta activa y prefetch por hover/foco', () => {
  const fixture = sidebarFixture({ pathname: '/quejas/expediente' })
  const nodes = elements(fixture.element)
  const links = nodes.filter(node => node.type === 'a')
  assert.deepEqual(links.map(node => node.props.href), ['/', '/quejas'])
  const quejas = links.find(node => node.props.href === '/quejas')
  assert.equal(quejas.props['aria-current'], 'page')
  assert.equal(fixture.preloads.length, 0, 'no precargar registros durante render')
  quejas.props.onMouseEnter()
  quejas.props.onFocus()
  assert.equal(fixture.preloads.length, 2)
  assert.equal(fixture.preloads[0], fixture.preloads[1])
  assert.equal(fixture.preloads[0].queryKey[0], 'quejas')
  quejas.props.onClick()
  assert.deepEqual(fixture.clicks, [false])
  assert.ok(!links.some(node => node.props.href === '/usuarios'))
})

test('Sidebar mantiene grupos y excepción de configuración para admin', () => {
  const fixture = sidebarFixture({ rol: 'admin', permisos: [] })
  const nodes = elements(fixture.element)
  assert.ok(nodes.some(node => node.props.href === '/configuracion'))
  const group = nodes.find(node => node.props['aria-label'] === 'Administración')
  group.props.onClick()
  assert.deepEqual(fixture.clicks[0], ['Administración', true])
})

test('Sidebar móvil es diálogo controlado; escritorio conserva el riel y su acción', () => {
  const mobile = sidebarFixture({ mobile: true })
  assert.equal(mobile.element.type, 'dialog')
  let prevented = false
  mobile.element.props.onCancel({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.deepEqual(mobile.clicks, [false])
  const desktop = sidebarFixture({ collapsed: true })
  assert.equal(desktop.element.type, 'aside')
  assert.match(desktop.element.props.className, /tw:w-16/)
  assert.match(desktop.element.props.className, /tw:has-\[:focus-visible\]:w-64/)
  const action = elements(desktop.element).find(node => node.props['aria-label'] === 'Expandir menú')
  action.props.onClick()
  assert.deepEqual(desktop.clicks, ['collapsed'])
})

test('AuthenticatedLayout reserva ancho sin CoreUI y bloquea solo scroll del fondo móvil', () => {
  const state = { collapsed: false, hidden: false, mobileOpen: false }
  let mobile = false
  const { default: Layout } = loadModule('components/AuthenticatedLayout.tsx', {
    '@/components/Sidebar': { default: 'aside' }, '@/components/Header': { default: 'header' },
    '@/lib/store/sidebar-store': { useSidebarStore: selector => selector(state) },
    '@/hooks/useMobileNavigation': { useMobileNavigation: () => mobile },
  })
  const render = () => renderToStaticMarkup(createElement(Layout, null, 'Contenido'))
  assert.match(render(), /tw:min-\[992px\]:pl-64/)
  state.collapsed = true
  assert.match(render(), /tw:min-\[992px\]:pl-16/)
  state.hidden = true
  assert.doesNotMatch(render(), /tw:min-\[992px\]:pl-/)
  mobile = true
  state.mobileOpen = true
  const html = render()
  assert.match(html, /id="app-content"[^>]*tw:overflow-hidden/)
  assert.doesNotMatch(html, /coreui-scope|app-main|style=/)
  assert.match(html, /href="#app-content"/)
})

test('Tab del menú móvil envuelve los extremos y omite enlaces de grupos ocultos', () => {
  const fixture = sidebarFixture({ mobile: true })
  const focused = []
  const first = { getClientRects: () => [1], focus: () => focused.push('first') }
  const hidden = { getClientRects: () => [], focus: () => focused.push('hidden') }
  const last = { getClientRects: () => [1], focus: () => focused.push('last') }
  let prevented = 0
  const event = { key: 'Tab', shiftKey: true, preventDefault: () => prevented++, currentTarget: { querySelectorAll: () => [first, last, hidden] } }
  fixture.document.activeElement = first
  fixture.element.props.onKeyDown(event)
  fixture.document.activeElement = last
  fixture.element.props.onKeyDown({ ...event, shiftKey: false })
  assert.deepEqual(focused, ['last', 'first'])
  assert.equal(prevented, 2)
})

test('notificaciones conserva callbacks separados de lectura, navegación y archivo', () => {
  const actions = []
  const { default: Notifications } = loadModule('components/header/NotificationDropdown.tsx', { '@/components/ui/tailwind/Popover': { default: 'div' } })
  const item = { id: 'q1', leida: false, mensaje: 'Queja recibida', fecha: '2026-10-05T12:00:00Z' }
  const element = Notifications({ open: true, notifications: [item], unreadCount: 1, onToggle() {}, onClose() {},
    onMarkAll() {}, onArchiveAll() {}, onMarkRead: n => actions.push(['leer', n.id]),
    onNavigate: n => actions.push(['abrir', n.id]), onArchive: n => actions.push(['archivar', n.id]) })
  const nodes = elements(element)
  nodes.find(node => node.type === 'button').props.onClick()
  assert.deepEqual(actions, [['leer', 'q1'], ['abrir', 'q1']])
  nodes.find(node => node.props['aria-label'] === 'Archivar notificación').props.onClick()
  assert.deepEqual(actions.at(-1), ['archivar', 'q1'])
})
