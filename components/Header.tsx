/**
 * Header — barra superior con título, notificaciones y menú de usuario.
 * El título viene de tituloDeRuta() (lib/constants/modulos.ts).
 * Notificaciones: realtime vía useRealtimeSubscription; sonidos vía sonidosNotificacion.
 * Dropdowns: NotificationDropdown y UserMenuDropdown (components/header/).
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth-store'
import { useNotificaciones, useMarcarNotificacionLeida, useMarcarTodasLeidas, useArchivarNotificacion, useArchivarTodas } from '@/lib/queries/useNotificaciones'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { SONIDO_DEFAULT, playNotificationSound } from '@/lib/services/sonidosNotificacion'
import CambiarMiPasswordModal from '@/components/usuarios/CambiarMiPasswordModal'
import NotificationDropdown from '@/components/header/NotificationDropdown'
import UserMenuDropdown from '@/components/header/UserMenuDropdown'
import AgendaHoyWidget from '@/components/ui/AgendaHoyWidget'
import { useAgendaHoy } from '@/lib/queries/useAgendaHoy'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { notificacionesKey } from '@/lib/queries/useNotificaciones'
import { queryKeys } from '@/lib/queries/queryKeys'
import { Menu } from 'lucide-react'
import { tituloDeRuta } from '@/lib/constants/modulos'
import { useNotificationSound } from '@/lib/hooks/useNotificationSound'

export default function Header({ onOpenNavigation }: { onOpenNavigation?: () => void } = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setPrefs = useAuthStore((s) => s.setPrefs)
  const [cambiarPasswordOpen, setCambiarPasswordOpen] = useState(false)
  const [guardandoPrefs, setGuardandoPrefs] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState<'agenda' | 'notif' | 'user' | null>(null)
  const agenda = useAgendaHoy(user?.id ?? '')

  const title = tituloDeRuta(pathname)
  const initials = user?.nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD'
  const notifHabilitadas = user?.notif_habilitadas !== false
  const notifSonido = user?.notif_sonido !== false
  const sonidoSeleccionado = user?.notif_sonido_id || SONIDO_DEFAULT


  const { data: notificaciones = [], isSuccess: notificacionesReady } = useNotificaciones(user?.id ?? '', notifHabilitadas)
  const marcarLeida = useMarcarNotificacionLeida()
  const marcarTodas = useMarcarTodasLeidas()
  const archivar = useArchivarNotificacion()
  const archivarTodas = useArchivarTodas()

  const noLeidas = notificaciones.filter((n) => !n.leida)
  const countNoLeidas = notifHabilitadas ? noLeidas.length : 0

  useRealtimeSubscription({
    table: 'notificaciones',
    filter: user ? `usuario_id=eq.${user.id}` : undefined,
    invalidateKeys: [notificacionesKey(user?.id ?? ''), queryKeys.agendaHoy],
    events: ['INSERT', 'UPDATE'],
  })

  useNotificationSound({ userId: user?.id ?? null, ready: notificacionesReady, notifications: notificaciones,
    enabled: notifHabilitadas, soundEnabled: notifSonido, soundId: user?.notif_sonido_id })

  const irA = (enlace?: string, origenId?: string) => {
    setMenuAbierto(null)
    if (enlace) {
      // Si hay un origen_id, agregarlo como query param para que la página destino abra el registro
      const url = origenId ? `${enlace}?abrir=${origenId}` : enlace
      router.push(url)
    }
  }

  // Cerrar menús con click fuera o Escape
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuAbierto) return
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuAbierto(null)
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const trigger = rootRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')
        setMenuAbierto(null)
        trigger?.focus()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [menuAbierto])

  const handlerPrefs = async (habilitadas: boolean, sonido: boolean) => {
    setGuardandoPrefs(true)
    const finalSonido = sonido ? sonidoSeleccionado : user?.notif_sonido_id || SONIDO_DEFAULT
    setPrefs({ notif_habilitadas: habilitadas, notif_sonido: sonido, notif_sonido_id: finalSonido })
    try {
      const { error } = await supabase.rpc('actualizar_mis_preferencias_notificacion', {
        p_habilitadas: habilitadas,
        p_sonido: sonido,
        p_sonido_id: finalSonido,
      })
      if (error) throw error
      showSuccess('Preferencias actualizadas')
    } catch (err) {
      showError(err as Error, 'No se pudieron guardar las preferencias')
      setPrefs({ notif_habilitadas: user?.notif_habilitadas, notif_sonido: user?.notif_sonido, notif_sonido_id: user?.notif_sonido_id })
    } finally {
      setGuardandoPrefs(false)
    }
  }

  const handlerCambiarSonido = async (id: string) => {
    setPrefs({ notif_sonido_id: id })
    setGuardandoPrefs(true)
    try {
      const { error } = await supabase.rpc('actualizar_mis_preferencias_notificacion', {
        p_habilitadas: user?.notif_habilitadas !== false,
        p_sonido: user?.notif_sonido !== false,
        p_sonido_id: id,
      })
      if (error) throw error
      showSuccess('Sonido actualizado')
    } catch (err) {
      showError(err as Error, 'No se pudo guardar el sonido')
        setPrefs({ notif_sonido_id: user?.notif_sonido_id })
    } finally {
      setGuardandoPrefs(false)
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-qms-border bg-qms-surface px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {onOpenNavigation && <button type="button" aria-label="Abrir menú de navegación" onClick={onOpenNavigation} className="ui-button ui-button-ghost ui-button-icon lg:hidden"><Menu className="h-5 w-5" aria-hidden="true" /></button>}
        <span className="truncate text-base font-semibold text-qms-dark">{title}</span>
      </div>

      <div ref={rootRef} className="flex shrink-0 items-center gap-2">
        <AgendaHoyWidget open={menuAbierto === 'agenda'} items={agenda.data ?? []} loading={agenda.isPending}
          error={agenda.isError} onToggle={() => {
            if (menuAbierto !== 'agenda' && agenda.isStale) void agenda.refetch({ cancelRefetch: false })
            setMenuAbierto(menuAbierto === 'agenda' ? null : 'agenda')
          }}
          onClose={() => setMenuAbierto(null)} onRetry={() => { void agenda.refetch() }} />
        <NotificationDropdown
          open={menuAbierto === 'notif'}
          onToggle={() => setMenuAbierto(menuAbierto === 'notif' ? null : 'notif')}
          notifications={notificaciones}
          unreadCount={countNoLeidas}
          onMarkAll={() => { if (user) marcarTodas.mutate(user.id) }}
          onArchiveAll={() => { if (user) archivarTodas.mutate(user.id) }}
          onMarkRead={(notification) => { if (!notification.leida && user) marcarLeida.mutate({ id: notification.id, userId: user.id }) }}
          onArchive={(notification) => { if (user) archivar.mutate({ id: notification.id, userId: user.id }) }}
          onNavigate={(notification) => irA(notification.enlace || undefined, notification.origen_id || undefined)}
          onTestSound={notifHabilitadas && notifSonido ? () => { void playNotificationSound(sonidoSeleccionado) } : undefined}
        />

        {user && <UserMenuDropdown
          open={menuAbierto === 'user'}
          user={user}
          initials={initials}
          saving={guardandoPrefs}
          soundId={sonidoSeleccionado}
          onToggle={() => setMenuAbierto(menuAbierto === 'user' ? null : 'user')}
          onPassword={() => { setMenuAbierto(null); setCambiarPasswordOpen(true) }}
          onPreferences={handlerPrefs}
          onSound={handlerCambiarSonido}
          onPreviewSound={() => playNotificationSound(sonidoSeleccionado)}
          onLogout={logout}
        />}
      </div>

      <CambiarMiPasswordModal open={cambiarPasswordOpen} onClose={() => setCambiarPasswordOpen(false)} />
    </header>
  )
}
