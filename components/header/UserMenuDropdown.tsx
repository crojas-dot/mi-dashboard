'use client'

import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import type { AppUser } from '@/lib/store/auth-store'
import Badge from '@/components/ui/Badge'
import { getRoleLabel, getRoleVariant } from '@/lib/constants/roles'
import FotoPerfil from '@/components/perfil/FotoPerfil'

interface UserMenuDropdownProps {
  open: boolean
  user: AppUser
  initials: string
  fotoUrl?: string
  onToggle: () => void
  onProfile: () => void
  onLogout: () => void
}

/**
 * Menú de cuenta del encabezado: identidad y dos acciones. La contraseña y las
 * preferencias de notificación viven dentro de «Mi perfil», no en este panel.
 */
export default function UserMenuDropdown({ open, user, initials, fotoUrl, onToggle, onProfile, onLogout }: UserMenuDropdownProps) {
  return (
    <div className="relative flex shrink-0 items-center border-l border-qms-border pl-2 sm:pl-3">
      <button type="button" onClick={onToggle} title={user.nombre} aria-label={`Menú de ${user.nombre}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? 'user-menu-panel' : undefined} className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-button border-0 bg-transparent p-1 no-underline transition-colors hover:bg-qms-hover-bg">
        <FotoPerfil url={fotoUrl} initials={initials} size={40} className="h-10 w-10 bg-qms-primary text-sm font-semibold text-white" />
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-qms-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div id="user-menu-panel" role="dialog" aria-label="Opciones de cuenta" className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-card border border-qms-border bg-qms-surface shadow-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80">
        <div className="flex min-w-0 items-center gap-3 border-b border-qms-border px-4 py-4">
          <FotoPerfil url={fotoUrl} initials={initials} size={48} className="h-12 w-12 bg-qms-primary text-base font-semibold text-white" />
          <div className="min-w-0">
            <p className="m-0 wrap-anywhere text-sm font-semibold text-qms-dark">{user.nombre}</p>
            <p className="mt-0.5 wrap-anywhere text-xs text-qms-muted">{user.email}</p>
            <div className="mt-1.5"><Badge variant={getRoleVariant(user.rol)}>{getRoleLabel(user.rol)}</Badge></div>
          </div>
        </div>
        <button type="button" onClick={onProfile} className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-4 py-3 text-left text-sm text-qms-dark transition-colors hover:bg-qms-hover-bg">
          <UserRound aria-hidden="true" className="h-[15px] w-[15px] text-qms-muted" />Mi perfil
        </button>
        <button type="button" onClick={onLogout} className="mt-2 flex w-full cursor-pointer items-center gap-2.5 rounded-b-card border-0 bg-transparent px-4 py-3 text-left text-sm font-medium text-qms-danger transition-colors hover:bg-qms-danger/10">
          <LogOut aria-hidden="true" className="h-[15px] w-[15px]" />Cerrar sesión
        </button>
      </div>}
    </div>
  )
}
