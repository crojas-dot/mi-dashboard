import { Mail } from 'lucide-react'
import { CORREO_QUEJA_LIMITES, type CorreoQueja } from '@/lib/utils/quejaCorreo'

interface Props { destinatario: string; correo: CorreoQueja; onChange: (correo: CorreoQueja) => void; disabled?: boolean; id: string }

/** Redacción en flujo continuo: el destinatario es de solo lectura y no se altera la lógica de envío. */
export default function QuejaCorreoEditor({ destinatario, correo, onChange, disabled = false, id }: Props) {
  return <section aria-label="Redactar correo al cliente" className="flex min-h-[17rem] flex-1 flex-col bg-qms-surface">
    <div className="shrink-0 px-4 pt-1 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 border-b border-qms-border py-3">
        <span className="w-14 shrink-0 text-sm text-qms-muted">Para</span>
        {destinatario ? <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-qms-border bg-qms-hover-bg px-3 py-1 text-sm text-qms-dark" title={destinatario}><Mail aria-hidden="true" className="size-3.5 shrink-0 text-qms-muted" /><span className="truncate">{destinatario}</span></span>
          : <span role="alert" className="text-sm text-qms-danger">Sin correo del cliente registrado</span>}
      </div>
      <div className="flex min-w-0 items-center gap-3 border-b border-qms-border py-3">
        <label htmlFor={id + '-asunto'} className="w-14 shrink-0 text-sm text-qms-muted">Asunto</label>
        <input id={id + '-asunto'} type="text" autoComplete="off" value={correo.asunto} maxLength={CORREO_QUEJA_LIMITES.asunto} required disabled={disabled}
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm font-medium text-qms-dark outline-none placeholder:text-qms-muted focus-visible:ring-0 disabled:opacity-65"
          placeholder="Asunto del correo"
          onChange={event => onChange({ ...correo, asunto: event.target.value })} />
      </div>
    </div>
    <div className="flex min-h-[12rem] flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5">
      <label htmlFor={id + '-mensaje'} className="sr-only">Mensaje</label>
      <textarea id={id + '-mensaje'} value={correo.cuerpo} maxLength={CORREO_QUEJA_LIMITES.cuerpo} required disabled={disabled}
        className="min-h-[12rem] w-full flex-1 resize-none border-0 bg-transparent text-base leading-relaxed text-qms-dark outline-none placeholder:text-qms-muted focus-visible:ring-0 disabled:opacity-65"
        placeholder="Escriba su mensaje aquí..."
        onChange={event => onChange({ ...correo, cuerpo: event.target.value })} />
      <span className="mt-2 text-right text-xs text-qms-muted">{correo.cuerpo.length} / {CORREO_QUEJA_LIMITES.cuerpo.toLocaleString('es-CR')}</span>
    </div>
  </section>
}
