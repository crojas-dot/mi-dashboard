'use client'

import { Mail, ShieldCheck } from 'lucide-react'
import Switch from '@/components/ui/Switch'

export default function UsuarioAccesoInicial({ invite, requireMfa, disabled, onInvite, onMfa }: {
  invite: boolean
  requireMfa: boolean
  disabled: boolean
  onInvite: (value: boolean) => void
  onMfa: (value: boolean) => void
}) {
  return <section data-user-create-access>
    <h3 className="mb-4 text-sm font-semibold text-qms-dark">Configuración de acceso</h3>
    <div className="divide-y divide-qms-border overflow-hidden rounded-card border border-qms-border bg-qms-surface">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary"><Mail className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h4 id="invite-label" className="text-sm font-semibold text-qms-dark">Enviar invitación por correo</h4>
          <p id="invite-help" className="mt-1 text-xs leading-relaxed text-qms-muted">El usuario recibirá un enlace personal válido durante 24 horas para configurar su contraseña.</p>
        </div>
        <Switch aria-labelledby="invite-label" aria-describedby="invite-help" checked={invite} onChange={onInvite} disabled={disabled} />
      </div>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary"><ShieldCheck className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h4 id="mfa-label" className="text-sm font-semibold text-qms-dark">Requerir verificación en dos pasos (2FA)</h4>
          <p id="mfa-help" className="mt-1 text-xs leading-relaxed text-qms-muted">Al completar su contraseña, deberá configurar una aplicación autenticadora o un correo alternativo.</p>
        </div>
        <Switch aria-labelledby="mfa-label" aria-describedby="mfa-help" checked={requireMfa} onChange={onMfa} disabled={disabled} />
      </div>
    </div>
    {!invite && <p role="status" className="mt-3 rounded-button bg-qms-primary-soft px-3 py-2 text-xs leading-relaxed text-qms-dark">
      Sin invitación: se enviará por correo una contraseña temporal válida durante 72 horas. El usuario tendrá que cambiarla en su primer ingreso.
    </p>}
  </section>
}
