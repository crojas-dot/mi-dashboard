'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, LogOut, KeyRound, BellRing, BellOff, X, Inbox, Play } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth-store'
import { useNotificaciones, useMarcarNotificacionLeida, useMarcarTodasLeidas, useArchivarNotificacion, useArchivarTodas } from '@/lib/queries/useNotificaciones'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { SONIDOS_NOTIFICACION, SONIDO_DEFAULT, playNotificationSound } from '@/lib/services/sonidosNotificacion'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import CambiarMiPasswordModal from '@/components/usuarios/CambiarMiPasswordModal'
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
  const { user, logout, setPrefs } = useAuthStore()
  const [cambiarPasswordOpen, setCambiarPasswordOpen] = useState(false)
  const [guardandoPrefs, setGuardandoPrefs] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState<'notif' | 'user' | null>(null)

  const title = titles[pathname] || 'QMS'
  const initials = user?.nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD'
  const notifHabilitadas = user?.notif_habilitadas !== false
  const notifSonido = user?.notif_sonido !== false
  const [sonidoSeleccionado, setSonidoSeleccionado] = useState<string>(user?.notif_sonido_id || SONIDO_DEFAULT)

  useEffect(() => {
    if (user?.notif_sonido_id) setSonidoSeleccionado(user.notif_sonido_id)
  }, [user?.notif_sonido_id])

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

  // Sonido al llegar una notificación nueva (solo si está habilitado y el toggle de sonido on)
  // El primer render siembra el ref para no sonar por notificaciones ya existentes;
  // cualquier incremento posterior (incluido 0→1) debe reproducir el tono.
  const prevCountRef = useRef<number | null>(null)
  useEffect(() => {
    if (notifHabilitadas && notifSonido) {
      const prev = prevCountRef.current
      if (prev !== null && countNoLeidas > prev) playNotificationSound(user?.notif_sonido_id)
      prevCountRef.current = countNoLeidas
    } else {
      prevCountRef.current = countNoLeidas
    }
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
    setSonidoSeleccionado(id)
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
      setSonidoSeleccionado(user?.notif_sonido_id || SONIDO_DEFAULT)
      setPrefs({ notif_sonido_id: user?.notif_sonido_id })
    } finally {
      setGuardandoPrefs(false)
    }
  }

  const roleVariant: Record<string, string> = { admin: 'blue', calidad: 'green', coordinador: 'amber', revisor: 'purple', usuario: 'gray' }

  return (
    <header className="flex items-center justify-between px-5" style={{ height: '56px', backgroundColor: '#fff', borderBottom: '1px solid #dee2e6' }}>
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center rounded font-bold text-white shrink-0" style={{ width: '26px', height: '26px', backgroundColor: '#0d6efd', fontSize: '11px' }}>E</div>
        <span className="font-semibold" style={{ color: '#343a40', fontSize: '0.95rem' }}>ECA-QMS</span>
        <span className="hidden md:inline text-sm" style={{ color: '#6c757d', fontWeight: 400 }}>/ {title}</span>
      </div>

      <div ref={rootRef} className="flex items-center gap-2">
        <div className="relative">
          <button
            className="relative flex items-center justify-center rounded-lg p-2.5 transition-colors"
            style={{ color: '#6c757d', border: 'none', background: 'transparent', cursor: 'pointer' }}
            onClick={() => setMenuAbierto(menuAbierto === 'notif' ? null : 'notif')}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Bell style={{ width: '20px', height: '20px' }} />
            {countNoLeidas > 0 && (
              <span className="absolute flex items-center justify-center rounded-full text-white text-[11px] font-bold"
                style={{ minWidth: '18px', height: '18px', backgroundColor: '#dc3545', top: '-5px', right: '-5px', padding: '0 4px' }}>
                {countNoLeidas}
              </span>
            )}
          </button>

          {menuAbierto === 'notif' && (
            <>
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-white" style={{ top: '100%', borderColor: '#dee2e6', boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">Notificaciones</p>
                  <div className="flex items-center gap-1.5">
                    {notificaciones.length > 0 && (
                      <>
                        {countNoLeidas > 0 && (
                          <button
                            onClick={async () => { if (user) await marcarTodas.mutateAsync(user.id) }}
                            className="text-xs text-blue-600 hover:underline"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                          >
                            Leer todas
                          </button>
                        )}
                        <button
                          onClick={async () => { if (user) await archivarTodas.mutateAsync(user.id) }}
                          className="text-xs text-gray-500 hover:text-red-600 hover:underline"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                          title="Eliminar todas las visibles"
                        >
                          Vaciar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notificaciones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-3 py-8 text-center">
                      <Inbox className="h-6 w-6 mb-1" style={{ color: '#ced4da' }} />
                      <p className="text-sm text-gray-400">No hay notificaciones</p>
                    </div>
                  ) : notificaciones.slice(0, 15).map((n) => (
                    <div
                      key={n.id}
                      className="group relative flex items-start gap-2 border-b border-gray-50 px-3 py-2.5 transition-colors"
                      style={{ cursor: 'pointer', background: n.leida ? 'transparent' : 'rgba(13,110,253,0.06)' }}
                      onClick={() => {
                        if (!n.leida && user) marcarLeida.mutate({ id: n.id, userId: user.id })
                        irA(n.enlace || undefined, n.origen_id || undefined)
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = n.leida ? 'transparent' : 'rgba(13,110,253,0.06)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${n.leida ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>{n.mensaje}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(n.fecha).toLocaleString('es-ES')}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (user) archivar.mutate({ id: n.id, userId: user.id })
                        }}
                        title="Eliminar"
                        className="flex items-center justify-center rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ border: 'none', background: 'transparent', color: '#adb5bd', cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#dc3545' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#adb5bd' }}
                      >
                        <X style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-l pl-3 relative" style={{ borderColor: '#dee2e6' }}>
          <button
            onClick={() => setMenuAbierto(menuAbierto === 'user' ? null : 'user')}
            className="flex items-center gap-2 rounded-lg transition-colors no-underline"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <div className="flex items-center justify-center rounded-full text-white font-medium shrink-0" style={{ width: '30px', height: '30px', backgroundColor: '#0d6efd', fontSize: '11px' }}>
              {initials}
            </div>
            <div className="leading-tight hidden sm:block text-left">
              <p className="text-sm font-medium m-0" style={{ color: '#212529' }}>{user?.nombre || 'Usuario'}</p>
              <p className="m-0 capitalize" style={{ color: '#6c757d', fontSize: '0.85rem' }}>{user?.rol || ''}</p>
            </div>
          </button>

          {menuAbierto === 'user' && (
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border bg-white" style={{ top: '100%', borderColor: '#dee2e6', boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="m-0 text-sm font-semibold truncate" style={{ color: '#212529' }}>{user?.nombre || 'Usuario'}</p>
                <p className="m-0 text-xs truncate" style={{ color: '#6c757d' }}>{user?.email || ''}</p>
                <div className="mt-1.5">
                  <Badge variant={roleVariant[user?.rol || ''] || 'gray'}>{user?.rol || 'usuario'}</Badge>
                </div>
              </div>

              <button
                onClick={() => setCambiarPasswordOpen(true)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                style={{ border: 'none', background: 'transparent', color: '#212529', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <KeyRound style={{ width: '15px', height: '15px', color: '#6c757d' }} />
                Cambiar contraseña
              </button>

              <div className="border-t border-gray-100 px-4 py-2.5 space-y-3">
                <p className="m-0 text-xs font-medium uppercase tracking-wide" style={{ color: '#6c757d' }}>Notificaciones</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BellRing style={{ width: '14px', height: '14px', color: '#6c757d' }} />
                    <span className="text-sm" style={{ color: '#212529' }}>Activas</span>
                  </div>
                  <Switch checked={notifHabilitadas} disabled={guardandoPrefs} onChange={(v) => handlerPrefs(v, user?.notif_sonido !== false)} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BellOff style={{ width: '14px', height: '14px', color: '#6c757d' }} />
                    <span className="text-sm" style={{ color: '#212529' }}>Sonido</span>
                  </div>
                  <Switch checked={notifSonido} disabled={guardandoPrefs} onChange={(v) => handlerPrefs(user?.notif_habilitadas !== false, v)} />
                </div>

                {notifSonido && (
                  <div className="flex items-center gap-2">
                    <select
                      value={sonidoSeleccionado}
                      onChange={(e) => handlerCambiarSonido(e.target.value)}
                      disabled={guardandoPrefs}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      style={{ color: '#212529', cursor: 'pointer' }}
                    >
                      {SONIDOS_NOTIFICACION.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => playNotificationSound(sonidoSeleccionado)}
                      title="Probar sonido"
                      className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
                      style={{ border: '1px solid #dee2e6', background: '#fff', color: '#0d6efd', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff' }}
                    >
                      <Play style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-b-xl border-t border-gray-100 px-4 py-3 text-sm font-medium transition-colors"
                style={{ borderLeft: 'none', borderRight: 'none', borderBottom: 'none', background: 'transparent', color: '#dc3545', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <LogOut style={{ width: '15px', height: '15px' }} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      <CambiarMiPasswordModal open={cambiarPasswordOpen} onClose={() => setCambiarPasswordOpen(false)} />
    </header>
  )
}