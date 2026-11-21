'use client'

import { Mail } from 'lucide-react'
import Switch from '@/components/ui/Switch'

export default function UsuarioAccesoInicial({ sendByEmail, disabled, onChange }: {
  sendByEmail: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}) {
  return <section data-user-create-access>
    <h3 className="mb-4 text-sm font-semibold text-qms-dark">Configuración de acceso</h3>
    <div className="flex items-start gap-3 rounded-card border border-qms-border bg-qms-surface p-4 sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary"><Mail aria-hidden="true" className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <h4 id="access-mail-label" className="text-sm font-semibold">Enviar acceso por correo</h4>
        <p id="access-mail-help" className="mt-1 text-xs leading-relaxed text-qms-muted">Enviaremos al usuario una contraseña temporal y el enlace para ingresar.</p>
      </div>
      <Switch aria-labelledby="access-mail-label" aria-describedby="access-mail-help" checked={sendByEmail} onChange={onChange} disabled={disabled} />
    </div>
  </section>
}
