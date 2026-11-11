import Field from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import { CORREO_QUEJA_LIMITES, type CorreoQueja } from '@/lib/utils/quejaCorreo'

interface Props { destinatario: string; correo: CorreoQueja; onChange: (correo: CorreoQueja) => void; disabled?: boolean; id: string }

export default function QuejaCorreoEditor({ destinatario, correo, onChange, disabled = false, id }: Props) {
  return <section aria-label="Redactar correo al cliente" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-qms-hover-bg p-3 sm:p-4">
    <div className="mx-auto flex min-h-[26rem] w-full max-w-5xl flex-1 flex-col gap-3 rounded-card border border-qms-border bg-qms-surface p-4">
      <p className="min-w-0 break-all text-sm"><span className="mr-3 text-qms-muted">Para</span>{destinatario || 'Sin correo registrado'}</p>
      <Field id={id + '-asunto'} label="Asunto"><Input id={id + '-asunto'} value={correo.asunto} maxLength={CORREO_QUEJA_LIMITES.asunto} required disabled={disabled} onChange={event => onChange({ ...correo, asunto: event.target.value })} /></Field>
      <Field id={id + '-mensaje'} label="Mensaje" className="flex min-h-0 flex-1 flex-col">
        <textarea id={id + '-mensaje'} className="ui-textarea min-h-64 w-full flex-1 resize-none px-3 py-3 text-base leading-relaxed" value={correo.cuerpo} maxLength={CORREO_QUEJA_LIMITES.cuerpo} required disabled={disabled} onChange={event => onChange({ ...correo, cuerpo: event.target.value })} />
        <p className="mt-1 text-right text-xs text-qms-muted">{correo.cuerpo.length} / {CORREO_QUEJA_LIMITES.cuerpo.toLocaleString('es-CR')}</p>
      </Field>
    </div>
  </section>
}
