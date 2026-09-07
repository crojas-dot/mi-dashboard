'use client'

import { useState, useRef, useEffect } from 'react'
import { KeyRound, LogOut, BellRing, BellOff, Loader2, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth-store'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { SONIDOS_NOTIFICACION, SONIDO_DEFAULT, playNotificationSound } from '@/lib/services/sonidosNotificacion'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import CambiarMiPasswordModal from '@/components/usuarios/CambiarMiPasswordModal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/DropdownMenu'
import { formatBytes } from '@/lib/utils/format'
import { getRoleVariant, getRoleLabel } from '@/lib/constants/roles'

const SONIDO_DEFAULT_ID = SONIDO_DEFAULT

interface UserMenuProps {
  user: { id: string; nombre: string; email: string; rol: string; notif_habilitadas?: boolean; notif_sonido?: boolean; notif_sonido_id?: string; avatar_url?: string } | null
  onLogout: () => void
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [cambiarPasswordOpen, setCambiarPasswordOpen] = useState(false)
  const [guardandoPrefs, setGuardandoPrefs] = useState(false)
  const [sonidoSeleccionado, setSonidoSeleccionado] = useState<string>(user?.notif_sonido_id || SONIDO_DEFAULT_ID)

  const notifHabilitadas = user?.notif_habilitadas !== false
  const notifSonido = user?.notif_sonido !== false
  const initials = user?.nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD'

  useEffect(() => {
    if (user?.notif_sonido_id) setSonidoSeleccionado(user.notif_sonido_id)
  }, [user?.notif_sonido_id])

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
    <>
      <DropdownMenu
        trigger={
          <button
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
            aria-expanded={false}
            aria-haspopup="true"
            aria-label={`Menú de usuario: ${user.nombre}`}
          >
            <div className="flex items-center justify-center rounded-full bg-primary text-white font-medium shrink-0 w-8 h-8 text-xs">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{user.nombre}</p>
              <p className="text-xs text-gray-500 truncate max-w-[160px] capitalize">{getRoleLabel(user.rol)}</p>
            </div>
          </button>
        }
        align="right"
      >
        <DropdownMenuContent className="w-64 p-0">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.nombre}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            <div className="mt-1.5">
              <Badge variant={getRoleVariant(user.rol)}>{getRoleLabel(user.rol)}</Badge>
            </div>
          </div>

          <DropdownMenuItem
            onClick={() => setCambiarPasswordOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5"
          >
            <KeyRound className="h-4 w-4 text-gray-400" />
            Cambiar contraseña
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="px-4 py-2 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Notificaciones</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-gray-400" />
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
                <BellOff className="h-4 w-4 text-gray-400" />
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
                  <Play className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50"
            destructive
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CambiarMiPasswordModal open={cambiarPasswordOpen} onClose={() => setCambiarPasswordOpen(false)} />
    </>
  )
}