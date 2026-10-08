import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { loadModule } from './load-module.mjs'

// Ejercita los listeners del Header activo con DOM y sesión ficticios.
function fixture() {
  const listeners = new Map(), effects = [], updates = [], refs = []
  const document = { activeElement: null, addEventListener: (kind, fn) => listeners.set(kind, fn), removeEventListener: kind => listeners.delete(kind) }
  let stateIndex = 0
  const { default: Header } = loadModule('components/Header.tsx', {
    react: { ...React,
      useState: () => [[false, false, 'user'][stateIndex++], value => updates.push(value)],
      useRef: current => { const ref = { current }; refs.push(ref); return ref },
      useEffect: effect => effects.push(effect),
    },
    'next/navigation': { usePathname: () => '/quejas', useRouter: () => ({ push() {} }) },
    '@/lib/store/auth-store': { useAuthStore: select => select({ user: { id: 'test-user', nombre: 'Persona', email: 'example@example.test', rol: 'admin' }, logout() {}, setPrefs() {} }) },
    '@/lib/queries/useNotificaciones': {
      useNotificaciones: () => ({ data: [] }), notificacionesKey: id => ['notificaciones', id],
      useMarcarNotificacionLeida: () => ({}), useMarcarTodasLeidas: () => ({}),
      useArchivarNotificacion: () => ({}), useArchivarTodas: () => ({}),
    },
    '@/lib/supabase': { supabase: {} },
    '@/lib/services/errorToast': { showError() {}, showSuccess() {} },
    '@/lib/services/sonidosNotificacion': { SONIDO_DEFAULT: 'test', SONIDOS_NOTIFICACION: [], playNotificationSound() {} },
    '@/components/usuarios/CambiarMiPasswordModal': { default: 'PasswordModal' },
    '@/hooks/useRealtimeSubscription': { useRealtimeSubscription() {} },
  }, { document })
  Header()
  let focusCalls = 0
  const trigger = { focus() { focusCalls++; document.activeElement = trigger } }
  refs.at(-1).current = { contains: node => node === trigger, querySelector: () => trigger }
  const cleanup = effects.at(-1)()
  return { listeners, updates, trigger, document, cleanup, focusCalls: () => focusCalls }
}

test('Escape cierra el menú activo y devuelve el foco a su disparador', () => {
  const menu = fixture()
  menu.listeners.get('keydown')({ key: 'Escape' })
  assert.equal(menu.updates.at(-1), null)
  assert.equal(menu.document.activeElement, menu.trigger)
  assert.equal(menu.focusCalls(), 1)
  menu.cleanup()
  assert.equal(menu.listeners.size, 0)
})

test('cerrar el menú con un clic externo no roba el foco de otro control', () => {
  const menu = fixture(), outside = {}
  menu.document.activeElement = outside
  menu.listeners.get('mousedown')({ target: outside })
  assert.equal(menu.updates.at(-1), null)
  assert.equal(menu.document.activeElement, outside)
  assert.equal(menu.focusCalls(), 0)
  menu.cleanup()
})
