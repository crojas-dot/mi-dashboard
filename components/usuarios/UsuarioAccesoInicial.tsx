'use client'

import { Mail } from 'lucide-react'
export default function UsuarioAccesoInicial() {
  return <section data-user-create-access>
    <h3 className="mb-4 text-sm font-semibold text-qms-dark">Configuración de acceso</h3>
    <div className="flex items-start gap-3 rounded-card border border-qms-border bg-qms-surface p-4 sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-qms-primary-soft text-qms-primary"><Mail aria-hidden="true" className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <h4 id="access-mail-label" className="text-sm font-semibold">Acceso por correo</h4>
        <p id="access-mail-help" className="mt-1 text-xs leading-relaxed text-qms-muted">Se enviará automáticamente una contraseña temporal válida durante 72 horas y el enlace al sistema. El usuario deberá cambiar la contraseña al ingresar.</p>
      </div>
    </div>
  </section>
}
