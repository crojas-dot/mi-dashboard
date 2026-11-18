import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { loadModule } from './load-module.mjs'

function visit(node) {
  if (Array.isArray(node)) return node.flatMap(visit)
  return node?.props ? [node, ...visit(node.props.children)] : []
}

function label(node) {
  if (Array.isArray(node)) return node.map(label).join('')
  return node?.props ? label(node.props.children) : typeof node === 'string' ? node : ''
}

function headerFor(pathname, section = 'catalogos') {
  const changes = []
  const { default: Header } = loadModule('components/Header.tsx', {
    react: { ...React, useEffect() {}, useRef: () => ({ current: null }), useState: initial => [initial, () => {}] },
    'next/link': { default: 'a' },
    'next/navigation': { usePathname: () => pathname, useRouter: () => ({ push() {} }) },
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ user: null, logout() {} }) },
    '@/lib/store/configuration-section-store': {
      CONFIG_SECTION_LABELS: {
        general: 'Ajustes generales', catalogos: 'Catálogos', sla: 'Plazos de atención',
        calendario: 'Calendario laboral', vistas: 'Vista por rol',
        formularios: 'Formularios públicos', ia: 'Asistente de IA',
      },
      useConfigSectionStore: selector => selector({ section, setSection: value => changes.push(value) }),
    },
    '@/lib/queries/useNotificaciones': {
      useNotificaciones: () => ({ data: { items: [], sinLeer: 0, total: 0 }, isSuccess: true }),
      useMarcarNotificacionLeida: () => ({ mutate() {} }),
      useMarcarTodasLeidas: () => ({ mutate() {} }),
      useArchivarNotificacion: () => ({ mutate() {} }),
      useArchivarTodas: () => ({ mutate() {} }),
      notificacionesKey: () => ['notificaciones'],
    },
    '@/components/header/NotificationDropdown': { default: 'NotificationDropdown' },
    '@/components/header/UserMenuDropdown': { default: 'UserMenuDropdown' },
    '@/components/perfil/MiPerfilModal': { default: 'MiPerfilModal' },
    '@/components/ui/AgendaHoyWidget': { default: 'AgendaHoyWidget' },
    '@/lib/queries/useAgendaHoy': { useAgendaHoy: () => ({ data: [], isPending: false, isError: false }) },
    '@/hooks/useRealtimeSubscription': { useRealtimeSubscription() {} },
    '@/lib/queries/queryKeys': { queryKeys: { agendaHoy: ['agendaHoy'] } },
    '@/lib/hooks/useNotificationSound': { useNotificationSound() {} },
    '@/lib/queries/useFotoPerfil': { useFotoPerfil: () => null },
    '@/lib/permisos': { moduloDeRuta: () => '' },
  })
  const element = Header({ onToggleNavigation() {} })
  const nav = visit(element).find(node => node.type === 'nav' && node.props['aria-label'] === 'Ruta de navegación')
  return { nav, changes }
}

test('el encabezado refleja la sección real de Configuración y permite volver a Catálogos', () => {
  const { nav, changes } = headerFor('/configuracion', 'calendario')
  assert.equal(label(nav).trim(), 'Configuración/Calendario laboral')
  assert.equal(visit(nav).find(node => node.props['aria-current'] === 'page').props.children, 'Calendario laboral')
  visit(nav).find(node => node.type === 'button').props.onClick()
  assert.deepEqual(changes, ['catalogos'])
  assert.equal(label(headerFor('/configuracion', 'catalogos').nav).trim(), 'Configuración/Catálogos')
})

test('las rutas de módulos muestran Inicio / módulo y Dashboard mantiene una sola etiqueta', () => {
  const quejas = headerFor('/quejas').nav
  assert.equal(label(quejas).trim(), 'Inicio/Quejas')
  assert.equal(visit(quejas).find(node => node.type === 'a').props.href, '/')
  assert.equal(label(headerFor('/').nav).trim(), 'Dashboard')
})
