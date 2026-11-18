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
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' ? node : ''

function sidebarFixture({ pathname = '/quejas', collapsed = false, permisos = [{ modulo: 'quejas', leer: true }], rol = 'colaborador', expanded = false } = {}) {
  const preloads = [], clicks = []
  const state = { collapsed, toggle: () => clicks.push('collapsed') }
  const mocks = {
    react: { ...React, useEffect() {}, useRef: () => ({ current: null }) },
    'next/link': { default: 'a' }, 'next/navigation': { usePathname: () => pathname },
    '@/hooks/useHoverPrefetch': { useHoverPrefetch: () => config => preloads.push(config) },
    '@/lib/store/sidebar-store': { useSidebarStore: selector => selector ? selector(state) : state },
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ user: { id: 'usuario-local', rol }, permisos }) },
    '@/lib/queries/pagination': { paginaKey: key => [...key, 0, 25] },
  }
  const queryModules = {
    useQuejas: { fetchQuejas() {}, quejasKey: () => ['quejas'] },
    useDocumentos: { fetchDocumentos() {}, documentosKey: ['documentos'] },
    useSACP: { fetchAcciones() {}, accionesKey: ['acciones'] },
    useRiesgos: { fetchRiesgos() {}, riesgosKey: ['riesgos'] },
    useAuditorias: { fetchAuditorias() {}, auditoriasKey: ['auditorias'] },
    useReuniones: { fetchReuniones() {}, reunionesKey: ['reuniones'] },
    useProcesos: { fetchProcesos() {}, procesosKey: ['procesos'] },
    useUsuarios: { fetchUsuarios() {}, usuariosQueryKey: () => ['usuarios'] },
    useDashboard: { dashboardPrefetchOptions: () => [] },
    useLogoEmpresa: { useLogoEmpresa: () => ({ data: '' }) },
  }
  for (const [name, exports] of Object.entries(queryModules)) mocks['@/lib/queries/' + name] = exports
  const { default: Sidebar } = loadModule('components/Sidebar.tsx', mocks)
  return { element: Sidebar({ expanded, onNavigate: expanded ? () => clicks.push('closed') : undefined }), preloads, clicks }
}

test('Sidebar conserva permisos, ruta activa y prefetch por hover/foco/tacto', () => {
  const fixture = sidebarFixture({ expanded: true })
  const nav = elements(fixture.element).find(node => node.type === 'nav' && node.props['aria-label'] === 'Navegación principal')
  const links = elements(nav).filter(node => node.type === 'a')
  assert.deepEqual(links.map(node => node.props.href), ['/', '/quejas'])
  const quejas = links.find(node => node.props.href === '/quejas')
  assert.equal(quejas.props['aria-current'], 'page')
  assert.equal(fixture.preloads.length, 0, 'no precargar registros durante render')
  quejas.props.onMouseEnter(); quejas.props.onFocus(); quejas.props.onTouchStart()
  assert.equal(fixture.preloads.length, 3)
  assert.ok(fixture.preloads.every(config => config === fixture.preloads[0]))
  assert.equal(fixture.preloads[0].queryKey[0], 'quejas')
  quejas.props.onClick()
  assert.deepEqual(fixture.clicks, ['closed'])
  assert.ok(!links.some(node => node.props.href === '/usuarios'))
})

test('Revisión por Dirección se muestra sin recortes conservando los íconos Lucide', () => {
  const fixture = sidebarFixture({ rol: 'colaborador', permisos: [{ modulo: 'revision', leer: true }] })
  const revision = elements(fixture.element).find(node => node.type === 'a' && node.props.href === '/revision')
  assert.ok(revision)
  assert.ok(revision.props.className.split(/\s+/).includes('min-h-11'))
  assert.ok(!revision.props.className.split(/\s+/).includes('h-11'))
  const label = elements(revision).find(node => node.type === 'span' && text(node) === 'Revisión por Dirección')
  assert.ok(label)
  assert.match(label.props.className, /whitespace-normal/)
  assert.doesNotMatch(label.props.className, /overflow-hidden whitespace-nowrap/)
  assert.equal(elements(revision).filter(node => node.type === 'svg').length, 0, 'el componente Lucide se renderiza como componente, no como sprite CoreUI')
  const collapsed = sidebarFixture({ rol: 'colaborador', permisos: [{ modulo: 'revision', leer: true }], collapsed: true })
  const compact = elements(collapsed.element).find(node => node.type === 'a' && node.props.href === '/revision')
  const compactLabel = elements(compact).find(node => node.type === 'span' && text(node) === 'Revisión por Dirección')
  assert.match(compactLabel.props.className, /max-w-0 whitespace-nowrap/)
})

test('Sidebar conserva los grupos visibles y excepción de Configuración para admin', () => {
  const fixture = sidebarFixture({ rol: 'admin', permisos: [] })
  const nodes = elements(fixture.element)
  assert.ok(nodes.some(node => node.props.href === '/configuracion'))
  assert.ok(nodes.some(node => node.type === 'p' && text(node) === 'Administración'))
  assert.ok(!nodes.some(node => node.props.href === '/quejas'))
})

test('Sidebar mantiene logo en el riel; solo el drawer móvil incluye botón de cierre', () => {
  const expanded = sidebarFixture({ expanded: true, collapsed: true })
  assert.equal(expanded.element.type, 'aside')
  assert.match(expanded.element.props.className, /w-\[250px\]/)
  elements(expanded.element).find(node => node.props['aria-label'] === 'Cerrar menú de navegación').props.onClick()
  assert.deepEqual(expanded.clicks, ['closed'])

  const desktop = sidebarFixture({ collapsed: true })
  assert.equal(desktop.element.type, 'aside')
  assert.equal(desktop.element.props.id, 'qms-main-sidebar')
  assert.match(desktop.element.props.className, /w-16/)
  assert.match(desktop.element.props.className, /transition-\[width\]/)
  const nodes = elements(desktop.element)
  assert.ok(nodes.some(node => node.props['aria-label'] === 'Ir al inicio'))
  assert.ok(!nodes.some(node => node.props.title === 'Expandir menú' || node.props.title === 'Contraer menú'))
  assert.ok(nodes.some(node => node.props['aria-hidden'] === true && text(node).trim() === 'ECA-QMS'))
})

test('AuthenticatedLayout reserva espacio flex y abre un único drawer móvil', () => {
  let mobile = false, mobileOpen = false
  const { default: Layout } = loadModule('components/AuthenticatedLayout.tsx', {
    react: { ...React, useState: () => [mobileOpen, value => { mobileOpen = value }] },
    '@/components/Sidebar': { default: 'aside' }, '@/components/Header': { default: props => createElement('header', null, props.children) },
    '@/components/Modal': { default: ({ open, children }) => open ? createElement('dialog', { open }, children) : null },
    '@/hooks/useMobileNavigation': { useMobileNavigation: () => mobile },
    '@/lib/store/sidebar-store': { useSidebarStore: () => ({ collapsed: false, toggle() {} }) },
  })
  const render = () => Layout({ children: 'Contenido' })
  const desktop = render()
  assert.match(desktop.props.className, /h-dvh.*overflow-hidden/)
  assert.equal(elements(desktop).find(node => node.props.variant === 'drawer').props.open, false)
  const topBar = elements(desktop).find(node => node.props.onToggleNavigation)
  assert.equal(topBar.props.navigationCollapsed, false)
  assert.equal(typeof topBar.props.onToggleNavigation, 'function')
  const html = renderToStaticMarkup(desktop)
  assert.match(html, /hidden shrink-0 lg:block/)
  assert.match(html, /min-w-0 flex-1 flex-col/)
  assert.match(html, /href="#app-content"/)
  assert.doesNotMatch(html, /coreui-scope|app-main|style=/)
  mobile = true
  elements(render()).find(node => typeof node.props.onOpenNavigation === 'function').props.onOpenNavigation()
  const drawer = elements(render()).find(node => node.props.variant === 'drawer')
  assert.equal(drawer.props.open, true)
  assert.equal(drawer.props.children.props.expanded, true)
  drawer.props.onClose()
  assert.equal(elements(render()).find(node => node.props.variant === 'drawer').props.open, false)
})

test('Tab del drawer envuelve extremos y omite controles ocultos', () => {
  const document = { activeElement: null }, focused = []
  const { default: Modal } = loadModule('components/Modal.tsx', {
    react: { useEffect() {}, useId: () => 'menu', useRef: current => ({ current }) },
  }, { document })
  const dialog = Modal({ open: true, title: 'Menú de navegación', variant: 'drawer', children: null, onClose() {} })
  const control = (name, visible = true) => ({ tabIndex: 0, matches: () => false, getClientRects: () => visible ? [1] : [], focus: () => focused.push(name) })
  const first = control('first'), last = control('last'), hidden = control('hidden', false)
  let prevented = 0
  const event = { key: 'Tab', shiftKey: true, preventDefault: () => prevented++, currentTarget: { querySelectorAll: () => [first, last, hidden] } }
  document.activeElement = first; dialog.props.onKeyDown(event)
  document.activeElement = last; dialog.props.onKeyDown({ ...event, shiftKey: false })
  assert.deepEqual(focused, ['last', 'first'])
  assert.equal(prevented, 2)
})

test('notificaciones conserva callbacks separados de lectura, navegación y archivo', () => {
  const actions = []
  const { default: Notifications } = loadModule('components/header/NotificationDropdown.tsx', {
    '@/lib/services/notificacionService': { NOTIFICACIONES_VISIBLES: 15 },
  })
  const item = { id: 'q1', leida: false, mensaje: 'Queja recibida', fecha: '2026-10-05T12:00:00Z' }
  const element = Notifications({ open: true, enabled: true, notifications: [item], total: 1, unreadCount: 1, onToggle() {}, onSettings() {},
    onMarkAll() {}, onArchiveAll() {}, onMarkRead: n => actions.push(['leer', n.id]),
    onNavigate: n => actions.push(['abrir', n.id]), onArchive: n => actions.push(['archivar', n.id]) })
  const nodes = elements(element)
  nodes.find(node => node.type === 'button' && text(node).includes(item.mensaje)).props.onClick()
  assert.deepEqual(actions, [['leer', 'q1'], ['abrir', 'q1']])
  nodes.find(node => node.props['aria-label'] === 'Archivar notificación').props.onClick()
  assert.deepEqual(actions.at(-1), ['archivar', 'q1'])
})
