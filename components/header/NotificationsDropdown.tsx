'use client'

import { useEffect, useRef, useState } from 'react';
import { Bell, Inbox, X, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useNotificaciones, useMarcarNotificacionLeida, useMarcarTodasLeidas, useArchivarNotificacion, useArchivarTodas } from '@/lib/queries/useNotificaciones';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/lib/services/errorToast';
import { SONIDOS_NOTIFICACION, SONIDO_DEFAULT, playNotificationSound } from '@/lib/services/sonidosNotificacion';

import Switch from '@/components/ui/Switch'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { notificacionesKey } from '@/lib/queries/useNotificaciones';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/DropdownMenu';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { formatDateTime } from '@/lib/utils/format';

const SONIDO_DEFAULT_ID = SONIDO_DEFAULT

interface NotificationsDropdownProps {
  user: { id: string; notif_habilitadas?: boolean; notif_sonido?: boolean; notif_sonido_id?: string } | null
}

export function NotificationsDropdown({ user }: NotificationsDropdownProps) {
  const router = useRouter()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [sonidoEditado, setSonidoSeleccionado] = useState<string | null>(null)
  const sonidoSeleccionado = sonidoEditado ?? user?.notif_sonido_id ?? SONIDO_DEFAULT_ID
  const [guardandoPrefs, setGuardandoPrefs] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const notifHabilitadas = user?.notif_habilitadas !== false
  const notifSonido = user?.notif_sonido !== false


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
    if (countNoLeidas > (prevCountRef.current ?? 0)) {
      playNotificationSound(user?.notif_sonido_id)
    }
    prevCountRef.current = countNoLeidas
  }, [countNoLeidas, notifHabilitadas, notifSonido, user?.notif_sonido_id])

  const irA = (enlace?: string, origenId?: string) => {
    setMenuAbierto(false)
    if (enlace) {
      const url = origenId ? `${enlace}?abrir=${origenId}` : enlace
      router.push(url)
    }
  }

  useEffect(() => {
    if (!menuAbierto) return
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuAbierto(false)
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
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
    const finalSonido = sonido ? sonidoSeleccionado : user?.notif_sonido_id || SONIDO_DEFAULT_ID
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
    } finally {
      setGuardandoPrefs(false)
    }
  }

  const handlerCambiarSonido = async (id: string) => {
    setSonidoSeleccionado(id)
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
      setSonidoSeleccionado(user?.notif_sonido_id || SONIDO_DEFAULT_ID)
    } finally {
      setGuardandoPrefs(false)
    }
  }

  if (!user) return null

  return (
    <DropdownMenu
      trigger={
        <button
          className="relative flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          onClick={() => setMenuAbierto(!menuAbierto)}
          aria-expanded={menuAbierto}
          aria-haspopup="true"
          aria-label={`Notificaciones${countNoLeidas > 0 ? `, ${countNoLeidas} sin leer` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {countNoLeidas > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold">
              {countNoLeidas > 9 ? '9+' : countNoLeidas}
            </span>
          )}
        </button>
      }
      align="right"
    >
      <DropdownMenuContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-gray-900">Notificaciones</p>
          <div className="flex items-center gap-1.5">
            {notificaciones.length > 0 && (
              <>
                {countNoLeidas > 0 && (
                  <DropdownMenuItem
                    onClick={async () => { if (user) await marcarTodas.mutateAsync(user.id) }}
                    className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1"
                  >
                    <Check className="h-3 w-3 mr-1" /> Leer todas
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => { if (user) await archivarTodas.mutateAsync(user.id) }}
                  className="text-xs text-gray-500 hover:bg-gray-50 px-2 py-1"
                >
                  <X className="h-3 w-3 mr-1" /> Vaciar
                </DropdownMenuItem>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-72" hideScrollbarX>
          {notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-3 py-8 text-center">
              <Inbox className="h-6 w-6 mb-1 text-gray-300" />
              <p className="text-sm text-gray-400">No hay notificaciones</p>
            </div>
          ) : (
            notificaciones.slice(0, 15).map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => {
                  if (!n.leida && user) marcarLeida.mutate({ id: n.id, userId: user.id })
                  irA(n.enlace || undefined, n.origen_id || undefined)
                }}
                className={`flex items-start gap-2 px-3 py-2 transition-colors ${
                  n.leida ? 'hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'
                }`}
                disabled={false}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.leida ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>{n.mensaje}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(n.fecha)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (user) archivar.mutate({ id: n.id, userId: user.id })
                  }}
                  className="flex shrink-0 items-center justify-center rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  aria-label="Eliminar notificación"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>

        <DropdownMenuSeparator />
        <div className="p-3 space-y-3 border-t border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700">Activas</span>
            </div>
            <Switch
              checked={notifHabilitadas}
              disabled={guardandoPrefs}
              onChange={(v: boolean) => handlerPrefs(v, user?.notif_sonido !== false)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700">Sonido</span>
            </div>
            <Switch
              checked={notifSonido}
              disabled={guardandoPrefs}
              onChange={(v: boolean) => handlerPrefs(user?.notif_habilitadas !== false, v)}
            />
          </div>

          {notifSonido && (
            <div className="flex items-center gap-2">
              <select
                value={sonidoSeleccionado}
                onChange={(e) => handlerCambiarSonido(e.target.value)}
                disabled={guardandoPrefs}
                className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              >
                {SONIDOS_NOTIFICACION.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => playNotificationSound(sonidoSeleccionado)}
                disabled={guardandoPrefs}
                className="flex items-center justify-center rounded-lg p-1.5 border border-gray-300 bg-white text-primary hover:bg-gray-50 transition-colors"
                title="Probar sonido"
              >
                <Loader2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}