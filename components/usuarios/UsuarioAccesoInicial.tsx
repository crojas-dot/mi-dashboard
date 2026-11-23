'use client'

import { Mail, ShieldCheck } from 'lucide-react'
import Switch from '@/components/ui/Switch'

export default function UsuarioAccesoInicial({ sendByEmail, requireMfa, disabled, onEmail, onMfa }: {
  sendByEmail: boolean
  requireMfa: boolean
  disabled: boolean
  onEmail: (value: boolean) => void
  onMfa: (value: boolean) => void
}) {
  return <section data-user-create-access>
    <h3 className="mb-4 text-sm font-semibold text-qms-dark">Acceso al sistema</h3>
    <div className="divide-y divide-qms-border overflow-hidden rounded-card border border-qms-border bg-qms-surface">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary">
          <Mail className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 id="access-email-label" className="text-sm font-semibold text-qms-dark">Enviar invitación por correo</h4>
          <p id="access-email-help" className="mt-1 text-xs leading-relaxed text-qms-muted">
            Envía el usuario, la contraseña temporal de 3 días hábiles y el botón para iniciar sesión. No requiere aceptar otra invitación.
          </p>
        </div>
        <Switch aria-labelledby="access-email-label" aria-describedby="access-email-help" checked={sendByEmail} onChange={onEmail} disabled={disabled} />
      </div>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 id="mfa-label" className="text-sm font-semibold text-qms-dark">Requerir verificación en dos pasos (2FA)</h4>
          <p id="mfa-help" className="mt-1 text-xs leading-relaxed text-qms-muted">
            Opcional. Si se activa, el usuario configurará su segundo factor al ingresar por primera vez.
          </p>
        </div>
        <Switch aria-labelledby="mfa-label" aria-describedby="mfa-help" checked={requireMfa} onChange={onMfa} disabled={disabled} />
      </div>
    </div>
    {!sendByEmail && <p role="status" className="mt-3 rounded-button bg-qms-primary-soft px-3 py-2 text-xs leading-relaxed text-qms-dark">
      Sin correo: la contraseña temporal aparecerá una sola vez tras crear el usuario para entregarla por un canal seguro.
    </p>}
  </section>
}
