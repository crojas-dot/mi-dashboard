'use client'
import { Mail, ShieldCheck } from 'lucide-react'
import Switch from '@/components/ui/Switch'

export default function UsuarioAccesoInicial({ invite, requireMfa, disabled, onInvite, onMfa }: { invite: boolean; requireMfa: boolean; disabled: boolean; onInvite: (value: boolean) => void; onMfa: (value: boolean) => void }) {
  return <section data-user-create-access>
    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-qms-dark"><span className="inline-flex size-6 items-center justify-center rounded-full bg-qms-primary-soft text-xs font-semibold text-qms-primary">2</span>Configuración de acceso</h3>
    <div className="divide-y divide-qms-border overflow-hidden rounded-card border border-qms-border bg-qms-surface">
      <div className="flex items-start gap-3 p-4 sm:p-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary"><Mail className="size-5" /></span><div className="min-w-0 flex-1"><h4 id="invite-label" className="text-sm font-semibold">Enviar invitación por correo</h4><p id="invite-help" className="mt-1 text-xs leading-relaxed text-qms-muted">Enviaremos un enlace seguro para configurar el acceso.</p></div><Switch aria-labelledby="invite-label" aria-describedby="invite-help" checked={invite} onChange={onInvite} disabled={disabled} /></div>
      <div className="flex items-start gap-3 p-4 sm:p-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary"><ShieldCheck className="size-5" /></span><div className="min-w-0 flex-1"><h4 id="mfa-label" className="text-sm font-semibold">Requerir verificación en dos pasos</h4><p id="mfa-help" className="mt-1 text-xs leading-relaxed text-qms-muted">El usuario deberá configurar un segundo factor de seguridad durante su primer ingreso.</p></div><Switch aria-labelledby="mfa-label" aria-describedby="mfa-help" checked={requireMfa} onChange={onMfa} disabled={disabled} /></div>
    </div>
    {!invite && <p role="status" className="mt-3 rounded-button bg-soft-amber-bg p-3 text-xs leading-relaxed text-soft-amber-text">Se generará una contraseña temporal, no se enviará invitación y el usuario deberá cambiarla en su primer ingreso.</p>}
  </section>
}
