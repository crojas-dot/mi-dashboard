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
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { notificacionesKey } from '@/lib/queries/useNotificaciones'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/quejas': 'Quejas',
  '/mis-quejas': 'Mis Quejas',
  '/documentos': 'Documentos',
  '/sacp': 'SACP',
  '/riesgos': 'Riesgos',
  '/auditorias': 'Auditorías',
  '/revision': 'Revisión por Dirección',
  '/procesos': 'Procesos',
  '/usuarios': 'Usuarios',
  '/configuracion': 'Configuración',
  '/reporteria': 'Reportería',
}

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setPrefs = useAuthStore((s) => s.setPrefs)
  const [cambiarPasswordOpen, setCambiarPasswordOpen] = useState(false)
  const [guardandoPrefs, setGuardandoPrefs] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState<'notif' | 'user' | null>(null)

  const title = titles[pathname] || 'QMS'
  const initials = user?.nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD'
  const notifHabilitadas = user?.notif_habilitadas !== false
  const notifSonido = user?.notif_sonido !== false
  const sonidoSeleccionado = user?.notif_sonido_id || SONIDO_DEFAULT


  const { data: notificaciones = [] } = useNotificaciones(user?.id ?? '', notifHabilitadas)
  const marcarLeida = useMarcarNotificacionLeida()
  const marcarTodas = useMarcarTodasLeidas()
  const archivar = useArchivarNotificacion()
  const archivarTodas = useArchivarTodas()

  const noLeidas = notificaciones.filter((n) => !n.leida)
  const countNoLeidas = notifHabilitadas ? noLeidas.length : 0

  useRealtimeSubscription({
    table: 'notificaciones',
    filter: user ? `usuario_id=eq.${user.id}` : undefined,
    invalidateKeys: [notificacionesKey(user?.id ?? '')],
    events: ['INSERT', 'UPDATE'],
  })

  // Sonido solo cuando el conteo de no leídas AUMENTA durante la sesión.
  // Seed ref sin sonar en el primer render; comparar en renders posteriores.
  const prevCountRef = useRef<number | null>(null)
  const initializedRef = useRef(false)
  useEffect(() => {
    if (!notifHabilitadas || !notifSonido) {
      prevCountRef.current = countNoLeidas
      initializedRef.current = true
      return
    }
    if (!initializedRef.current) {
      prevCountRef.current = countNoLeidas
      initializedRef.current = true
      return
    }
    if (countNoLeidas > prevCountRef.current!) {
      playNotificationSound(user?.notif_sonido_id)
    }
    prevCountRef.current = countNoLeidas
  }, [countNoLeidas, notifHabilitadas, notifSonido, user?.notif_sonido_id])

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
      if (e.key === 'Escape') setMenuAbierto(null)
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
    <header className="flex h-14 items-center justify-between border-b border-qms-border bg-qms-surface px-5">
      <div className="flex items-center gap-2">
        <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-button bg-qms-primary text-[11px] font-bold text-white">E</div>
        <span className="text-[0.95rem] font-semibold text-qms-header">ECA-QMS</span>
        <span className="hidden text-sm font-normal text-qms-muted md:inline">/ {title}</span>
      </div>

      <div ref={rootRef} className="flex items-center gap-2">
        <NotificationDropdown
          open={menuAbierto === 'notif'}
          onToggle={() => setMenuAbierto(menuAbierto === 'notif' ? null : 'notif')}
          notifications={notificaciones}
          unreadCount={countNoLeidas}
          onMarkAll={() => { if (user) void marcarTodas.mutateAsync(user.id) }}
          onArchiveAll={() => { if (user) void archivarTodas.mutateAsync(user.id) }}
          onMarkRead={(notification) => { if (!notification.leida && user) marcarLeida.mutate({ id: notification.id, userId: user.id }) }}
          onArchive={(notification) => { if (user) archivar.mutate({ id: notification.id, userId: user.id }) }}
          onNavigate={(notification) => irA(notification.enlace || undefined, notification.origen_id || undefined)}
        />

        {user && <UserMenuDropdown
          open={menuAbierto === 'user'}
          user={user}
          initials={initials}
          saving={guardandoPrefs}
          soundId={sonidoSeleccionado}
          onToggle={() => setMenuAbierto(menuAbierto === 'user' ? null : 'user')}
          onPassword={() => setCambiarPasswordOpen(true)}
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