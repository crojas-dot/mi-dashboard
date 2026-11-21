import { ShieldCheck, ShieldOff } from 'lucide-react'
import type { Usuario } from '@/lib/queries/useUsuarios'

const labels = { disabled: 'Desactivado', invite_pending: 'Invitación pendiente', invite_expired: 'Invitación vencida', password_pending: 'Contraseña pendiente', password_expired: 'Acceso temporal vencido', mfa_pending: '2FA pendiente', active: 'Activo' } as const

export function UsuarioEstadoAcceso({ usuario }: { usuario: Usuario }) {
  const status = usuario.estado !== 'activo' ? 'disabled' : usuario.access?.status ?? 'active'
  const classes = status === 'active' ? 'border-qms-success/15 bg-soft-green-bg text-soft-green-text' : status === 'disabled' ? 'border-qms-border bg-qms-hover-bg text-qms-muted' : 'border-qms-warning/15 bg-soft-amber-bg text-soft-amber-text'
  return <span className={`inline-flex items-center gap-1.5 rounded-button border px-2.5 py-1 text-xs font-semibold ${classes}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{labels[status]}</span>
}

export function UsuarioSegundoFactor({ usuario }: { usuario: Usuario }) {
  const policy = usuario.access
  const active = !!policy?.method
  const Icon = active ? ShieldCheck : ShieldOff
  const label = !policy?.requireMfa ? 'Contraseña' : policy.method === 'totp' ? 'App autenticadora' : policy.method === 'email' ? 'Correo alternativo' : 'Pendiente'
  return <span data-users-security className="inline-flex items-center gap-1.5 rounded-button border border-qms-border bg-qms-hover-bg px-2.5 py-1 text-xs font-medium text-qms-muted" title={!policy ? 'Esta cuenta conserva su política de acceso anterior' : undefined}><Icon aria-hidden="true" className="size-3.5" />{label}</span>
}
