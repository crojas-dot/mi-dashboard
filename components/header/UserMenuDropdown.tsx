'use client'

import { BellOff, BellRing, ChevronDown, KeyRound, LogOut, Play } from 'lucide-react'
import type { AppUser } from '@/lib/store/auth-store'
import { SONIDOS_NOTIFICACION } from '@/lib/services/sonidosNotificacion'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import Select from '@/components/ui/Select'
import { getRoleLabel, getRoleVariant } from '@/lib/constants/roles'

interface UserMenuDropdownProps {
  open: boolean
  user: AppUser
  initials: string
  saving: boolean
  soundId: string
  onToggle: () => void
  onPassword: () => void
  onPreferences: (enabled: boolean, sound: boolean) => void
  onSound: (id: string) => void
  onPreviewSound: () => void
  onLogout: () => void
}

export default function UserMenuDropdown({ open, user, initials, saving, soundId, onToggle, onPassword, onPreferences, onSound, onPreviewSound, onLogout }: UserMenuDropdownProps) {
  const notificationsEnabled = user.notif_habilitadas !== false
  const soundEnabled = user.notif_sonido !== false

  return (
    <div className="relative flex shrink-0 items-center border-l border-qms-border pl-2 sm:pl-3">
      <button type="button" onClick={onToggle} title={user.nombre} aria-label={`Menú de ${user.nombre}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? 'user-menu-panel' : undefined} className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-button border-0 bg-transparent p-1 no-underline transition-colors hover:bg-qms-hover-bg">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-qms-primary text-sm font-semibold text-white">
          {/* Centrado óptico de mayúsculas: compensar el espacio reservado a descendentes. */}
          <span className="translate-y-px leading-none">{initials}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-qms-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div id="user-menu-panel" role="dialog" aria-label="Opciones de cuenta" className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-card border border-qms-border bg-qms-surface shadow-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80">
        <div className="min-w-0 border-b border-qms-border px-4 py-4"><p className="m-0 wrap-anywhere text-sm font-semibold text-qms-dark">{user.nombre}</p><p className="mt-1 wrap-anywhere text-xs text-qms-muted">{user.email}</p><div className="mt-2"><Badge variant={getRoleVariant(user.rol)}>{getRoleLabel(user.rol)}</Badge></div></div>
        <button type="button" onClick={onPassword} className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-4 py-2.5 text-left text-sm text-qms-dark transition-colors hover:bg-qms-hover-bg"><KeyRound className="h-[15px] w-[15px] text-qms-muted" />Cambiar contraseña</button>
        <div className="space-y-3 border-t border-gray-100 px-4 py-2.5"><p className="m-0 text-xs font-medium uppercase tracking-wide text-qms-muted">Notificaciones</p>
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm text-qms-dark"><BellRing className="h-3.5 w-3.5 text-qms-muted" />Activas</span><Switch aria-label="Habilitar notificaciones" checked={notificationsEnabled} disabled={saving} onChange={(value) => onPreferences(value, soundEnabled)} /></div>
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm text-qms-dark"><BellOff className="h-3.5 w-3.5 text-qms-muted" />Sonido</span><Switch aria-label="Habilitar sonido de notificaciones" checked={soundEnabled} disabled={saving} onChange={(value) => onPreferences(notificationsEnabled, value)} /></div>
          {soundEnabled && <div className="flex items-center gap-2"><Select aria-label="Sonido de notificación" value={soundId} onChange={(event) => onSound(event.target.value)} disabled={saving} wrapperClassName="flex-1 [&>svg]:right-4" className="cursor-pointer pr-10">{SONIDOS_NOTIFICACION.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</Select><button type="button" onClick={onPreviewSound} title="Probar sonido" aria-label="Probar sonido" className="ui-button ui-button-link ui-button-icon shrink-0"><Play className="h-[13px] w-[13px]" aria-hidden="true" /></button></div>}
        </div>
        <button type="button" onClick={onLogout} className="flex w-full cursor-pointer items-center gap-2.5 rounded-b-card border-x-0 border-b-0 border-t border-gray-100 bg-transparent px-4 py-3 text-left text-sm font-medium text-qms-danger transition-colors hover:bg-red-50"><LogOut className="h-[15px] w-[15px]" />Cerrar sesión</button>
      </div>}
    </div>
  )
}
