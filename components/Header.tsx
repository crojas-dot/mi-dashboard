/**
 * Header — barra superior con título, notificaciones y menú de usuario.
 * El título viene de tituloDeRuta() (lib/constants/modulos.ts).
 * Notificaciones: realtime vía useRealtimeSubscription; sonidos vía sonidosNotificacion.
 * Dropdowns: NotificationDropdown y UserMenuDropdown (components/header/).
 * Mi perfil (nombre, contraseña, preferencias) vive en el modal personal MiPerfilModal.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth-store'
import { useNotificaciones, useMarcarNotificacionLeida, useMarcarTodasLeidas, useArchivarNotificacion, useArchivarTodas } from '@/lib/queries/useNotificaciones'
import NotificationDropdown from '@/components/header/NotificationDropdown'
import UserMenuDropdown from '@/components/header/UserMenuDropdown'
import MiPerfilModal from '@/components/perfil/MiPerfilModal'
import AgendaHoyWidget from '@/components/ui/AgendaHoyWidget'
import { useAgendaHoy } from '@/lib/queries/useAgendaHoy'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { notificacionesKey } from '@/lib/queries/useNotificaciones'
import { queryKeys } from '@/lib/queries/queryKeys'
import { Clock3, Menu } from 'lucide-react'
import { tituloDeRuta } from '@/lib/constants/modulos'
import { CONFIG_SECTION_LABELS, useConfigSectionStore } from '@/lib/store/configuration-section-store'
import { useNotificationSound } from '@/lib/hooks/useNotificationSound'
import { useFotoPerfil } from '@/lib/queries/useFotoPerfil'
import { moduloDeRuta } from '@/lib/permisos'

export default function Header({
  onOpenNavigation,
  mobileNavigationOpen = false,
  onToggleNavigation,
  navigationCollapsed = false,
}: {
  onOpenNavigation?: () => void
  mobileNavigationOpen?: boolean
  onToggleNavigation?: () => void
  navigationCollapsed?: boolean
} = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const access = useAuthStore((s) => s.access)
  const [menuAbierto, setMenuAbierto] = useState<'agenda' | 'notif' | 'user' | null>(null)
  const [perfilTab, setPerfilTab] = useState<'detalles' | 'seguridad' | 'notificaciones' | null>(null)
  const [avisoOmitido, setAvisoOmitido] = useState(false)
  useEffect(() => { setAvisoOmitido(false) }, [user?.id])
  const avisoTemporal = access?.phase === 'ready' && access.temporaryPassword === true && !avisoOmitido
  const fechaLimite = access?.temporaryPasswordExpiresAt
    ? new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Costa_Rica' }).format(new Date(access.temporaryPasswordExpiresAt))
    : null
  const agenda = useAgendaHoy(user?.id ?? '')
  const fotoUrl = useFotoPerfil()

  const title = tituloDeRuta(pathname)
  const configSection = useConfigSectionStore(state => state.section)
  const setConfigSection = useConfigSectionStore(state => state.setSection)
  const isConfig = pathname === '/configuracion'
  const isDashboard = pathname === '/' || pathname === '/dashboard'
  const currentBreadcrumb = isConfig ? CONFIG_SECTION_LABELS[configSection] : title
  const initials = user?.nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD'
  const notifHabilitadas = user?.notif_habilitadas !== false
  const notifSonido = user?.notif_sonido !== false
  const { data: bandeja, isSuccess: notificacionesReady } = useNotificaciones(user?.id ?? '', notifHabilitadas)
  const notificaciones = bandeja?.items ?? []
  const marcarLeida = useMarcarNotificacionLeida()
  const marcarTodas = useMarcarTodasLeidas()
  const archivar = useArchivarNotificacion()
  const archivarTodas = useArchivarTodas()

  const countNoLeidas = notifHabilitadas ? bandeja?.sinLeer ?? 0 : 0

  useRealtimeSubscription({
    table: 'notificaciones',
    enabled: !!user && notifHabilitadas,
    filter: user ? `usuario_id=eq.${user.id}` : undefined,
    invalidateKeys: [notificacionesKey(user?.id ?? '')],
    invalidateOnInsert: [queryKeys.agendaHoy],
    events: ['INSERT', 'UPDATE'],
  })

  useNotificationSound({ userId: user?.id ?? null, ready: notificacionesReady, notifications: notificaciones,
    enabled: notifHabilitadas, soundEnabled: notifSonido, soundId: user?.notif_sonido_id })

  const irA = (enlace?: string, origenId?: string) => {
    setMenuAbierto(null)
    // Solo navegar a módulos conocidos. Los valores de la campana provienen de la BD.
    if (!enlace?.startsWith('/') || enlace.startsWith('//') || enlace.includes('\\')) return
    const url = new URL(enlace, 'https://qms.invalid')
    if (url.origin !== 'https://qms.invalid' || !moduloDeRuta(url.pathname)) return
    if (origenId) url.searchParams.set('abrir', origenId)
    router.push(`${url.pathname}${url.search}${url.hash}`)
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

  return (
    <>
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-qms-border bg-qms-surface px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {onToggleNavigation && (
          <button
            type="button"
            aria-controls="qms-main-sidebar"
            aria-expanded={!navigationCollapsed}
            aria-label={navigationCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            title={navigationCollapsed ? 'Expandir menú' : 'Contraer menú'}
            onClick={onToggleNavigation}
            className="ui-button ui-button-ghost ui-button-icon hidden shrink-0 lg:inline-flex"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {onOpenNavigation && (
          <button
            type="button"
            aria-controls="qms-mobile-navigation"
            aria-expanded={mobileNavigationOpen}
            aria-label="Abrir menú de navegación"
            onClick={onOpenNavigation}
            className="ui-button ui-button-ghost ui-button-icon shrink-0 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <nav aria-label="Ruta de navegación" className="flex min-w-0 items-center gap-2 text-sm">
          {!isDashboard && (
            <>
              {isConfig ? (
                <button type="button" onClick={() => setConfigSection('catalogos')}
                  className="shrink-0 text-qms-muted transition-colors hover:text-qms-primary hover:underline">
                  Configuración
                </button>
              ) : (
                <Link href="/" className="shrink-0 text-qms-muted no-underline transition-colors hover:text-qms-primary hover:underline">Inicio</Link>
              )}
              <span aria-hidden="true" className="shrink-0 text-qms-muted/70">/</span>
            </>
          )}
          <span aria-current="page" className="truncate font-normal text-qms-muted">{currentBreadcrumb}</span>
        </nav>
      </div>

      <div ref={rootRef} className="flex shrink-0 items-center gap-2">
        <AgendaHoyWidget open={menuAbierto === 'agenda'} items={agenda.data ?? []} loading={agenda.isPending}
          error={agenda.isError && !agenda.data} onToggle={() => {
            if (menuAbierto !== 'agenda' && agenda.isStale) void agenda.refetch({ cancelRefetch: false })
            setMenuAbierto(menuAbierto === 'agenda' ? null : 'agenda')
          }}
          onClose={() => setMenuAbierto(null)} onRetry={() => { void agenda.refetch() }} />
        <NotificationDropdown
          open={menuAbierto === 'notif'}
          onToggle={() => setMenuAbierto(menuAbierto === 'notif' ? null : 'notif')}
          notifications={notifHabilitadas ? notificaciones : []}
          total={notifHabilitadas ? bandeja?.total ?? 0 : 0}
          enabled={notifHabilitadas}
          onSettings={() => { setMenuAbierto(null); setPerfilTab('notificaciones') }}
          unreadCount={countNoLeidas}
          onMarkAll={() => { if (user) marcarTodas.mutate(user.id) }}
          onArchiveAll={() => { if (user) archivarTodas.mutate(user.id) }}
          onMarkRead={(notification) => { if (!notification.leida && user) marcarLeida.mutate({ id: notification.id, userId: user.id }) }}
          onArchive={(notification) => { if (user) archivar.mutate({ id: notification.id, userId: user.id }) }}
          onNavigate={(notification) => irA(notification.enlace || undefined, notification.origen_id || undefined)}
        />

        {user && <UserMenuDropdown
          open={menuAbierto === 'user'}
          user={user}
          initials={initials}
          fotoUrl={fotoUrl}
          onToggle={() => setMenuAbierto(menuAbierto === 'user' ? null : 'user')}
          onProfile={() => { setMenuAbierto(null); setPerfilTab('detalles') }}
          onLogout={logout}
        />}
      </div>

    </header>
    {avisoTemporal && <div role="status" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-qms-border bg-qms-primary-soft px-4 py-2 text-sm text-qms-dark sm:px-5">
      <Clock3 aria-hidden="true" className="size-4 shrink-0 text-qms-primary" />
      <p className="min-w-0 flex-1 leading-relaxed">
        Tu contraseña es temporal. Tenés 3 días hábiles para cambiarla{fechaLimite ? ` (hasta el ${fechaLimite})` : ''}. Podés seguir utilizando el sistema mientras tanto.
      </p>
      <button type="button" onClick={() => setPerfilTab('seguridad')} className="shrink-0 font-semibold text-qms-primary underline underline-offset-2 hover:text-qms-dark">Cambiar en Mi perfil</button>
      <button type="button" onClick={() => setAvisoOmitido(true)} className="shrink-0 text-qms-muted hover:text-qms-dark" aria-label="Ocultar recordatorio de contraseña">Más tarde</button>
    </div>}
    {perfilTab && <MiPerfilModal open fotoUrl={fotoUrl} initialTab={perfilTab} onClose={() => setPerfilTab(null)} />}
    </>
  )
}
