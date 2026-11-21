'use client'

import { Mail, ShieldCheck } from 'lucide-react'
import Switch from '@/components/ui/Switch'

export default function UsuarioAccesoInicial({ requireMfa, disabled, onMfa }: {
  requireMfa: boolean
  disabled: boolean
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
          <h4 className="text-sm font-semibold text-qms-dark">Enviar acceso por correo</h4>
          <p className="mt-1 text-xs leading-relaxed text-qms-muted">
            El correo incluirá el usuario, una contraseña temporal válida durante 72 horas y el botón para iniciar sesión.
          </p>
        </div>
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
  </section>
}
