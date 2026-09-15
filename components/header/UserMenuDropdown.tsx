'use client'

import { BellOff, BellRing, KeyRound, LogOut, Play } from 'lucide-react'
import type { AppUser } from '@/lib/store/auth-store'
import { SONIDOS_NOTIFICACION } from '@/lib/services/sonidosNotificacion'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'

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
  const roleVariant: Record<string, string> = { admin: 'blue', calidad: 'green', coordinador: 'amber', revisor: 'purple', usuario: 'gray' }

  return (
    <div className="relative flex items-center gap-2 border-l border-qms-border pl-3">
      <button type="button" onClick={onToggle} className="flex cursor-pointer items-center gap-2 rounded-button border-0 bg-transparent p-1 no-underline transition-colors hover:bg-qms-hover-bg">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-qms-primary text-[11px] font-medium text-white">{initials}</div>
        <div className="hidden text-left leading-tight sm:block"><p className="m-0 text-sm font-medium text-qms-dark">{user.nombre}</p><p className="m-0 text-[0.85rem] capitalize text-qms-muted">{user.rol}</p></div>
      </button>
      {open && <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-card border border-qms-border bg-qms-surface shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3"><p className="m-0 truncate text-sm font-semibold text-qms-dark">{user.nombre}</p><p className="m-0 truncate text-xs text-qms-muted">{user.email}</p><div className="mt-1.5"><Badge variant={roleVariant[user.rol] || 'gray'}>{user.rol}</Badge></div></div>
        <button type="button" onClick={onPassword} className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-4 py-2.5 text-left text-sm text-qms-dark transition-colors hover:bg-qms-hover-bg"><KeyRound className="h-[15px] w-[15px] text-qms-muted" />Cambiar contraseña</button>
        <div className="space-y-3 border-t border-gray-100 px-4 py-2.5"><p className="m-0 text-xs font-medium uppercase tracking-wide text-qms-muted">Notificaciones</p>
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm text-qms-dark"><BellRing className="h-3.5 w-3.5 text-qms-muted" />Activas</span><Switch checked={notificationsEnabled} disabled={saving} onChange={(value) => onPreferences(value, soundEnabled)} /></div>
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm text-qms-dark"><BellOff className="h-3.5 w-3.5 text-qms-muted" />Sonido</span><Switch checked={soundEnabled} disabled={saving} onChange={(value) => onPreferences(notificationsEnabled, value)} /></div>
          {soundEnabled && <div className="flex items-center gap-2"><select value={soundId} onChange={(event) => onSound(event.target.value)} disabled={saving} className="flex-1 cursor-pointer rounded-button border border-qms-border bg-qms-surface px-2 py-1.5 text-sm text-qms-dark outline-none focus:border-qms-primary focus:ring-1 focus:ring-qms-primary">{SONIDOS_NOTIFICACION.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select><button type="button" onClick={onPreviewSound} title="Probar sonido" className="flex cursor-pointer items-center justify-center rounded-button border border-qms-border bg-qms-surface p-1.5 text-qms-primary hover:bg-qms-hover-bg"><Play className="h-[13px] w-[13px]" /></button></div>}
        </div>
        <button type="button" onClick={onLogout} className="flex w-full cursor-pointer items-center gap-2.5 rounded-b-card border-x-0 border-b-0 border-t border-gray-100 bg-transparent px-4 py-3 text-left text-sm font-medium text-qms-danger transition-colors hover:bg-red-50"><LogOut className="h-[15px] w-[15px]" />Cerrar sesión</button>
      </div>}
    </div>
  )
}
