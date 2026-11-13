'use client'

import { useEffect, useRef } from 'react'
import { Mail } from 'lucide-react'
import { REGISTRO_QUEJA_LIMITES } from '@/lib/constants/quejas'
import { CORREO_QUEJA_LIMITES, type CorreoQueja } from '@/lib/utils/quejaCorreo'

interface Props {
  destinatario: string
  oficio: string
  onOficioChange: (value: string) => void
  correo: CorreoQueja
  onChange: (correo: CorreoQueja) => void
  disabled?: boolean
  id: string
}

/** Redacción sin marcos interiores; Para y N.º de oficio comparten la primera fila. */
export default function QuejaCorreoEditor({ destinatario, oficio, onOficioChange, correo, onChange, disabled = false, id }: Props) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const area = messageRef.current
    if (!area) return
    area.style.height = '0px'
    area.style.height = Math.max(256, area.scrollHeight) + 'px'
  }, [correo.cuerpo])
  return <section aria-label="Redactar correo al cliente" className="flex min-h-[22rem] flex-1 flex-col bg-qms-surface">
    <div className="shrink-0 px-5 pt-3 sm:px-8 sm:pt-5">
      <div className="flex min-w-0 flex-col gap-4 border-b border-qms-border py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="w-12 shrink-0 text-sm text-qms-muted">Para</span>
          {destinatario
            ? <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-qms-hover-bg px-3 py-1.5 text-sm text-qms-dark" title={destinatario}>
                <Mail aria-hidden="true" className="size-3.5 shrink-0 text-qms-muted" />
                <span className="truncate">{destinatario}</span>
              </span>
            : <span role="alert" className="text-sm text-qms-danger">Sin correo del cliente registrado</span>}
        </div>
        <div className="flex min-w-0 items-center gap-3 sm:w-[min(46%,24rem)]">
          <label htmlFor={id + '-oficio'} className="shrink-0 text-xs text-qms-muted">N.º de oficio</label>
          <input id={id + '-oficio'} type="text" required value={oficio} maxLength={REGISTRO_QUEJA_LIMITES.oficio} disabled={disabled}
            onChange={event => onOficioChange(event.target.value)}
            placeholder="Oficio oficial de ECA"
            className="min-w-0 flex-1 border-0 border-b border-qms-border bg-transparent px-1 py-1.5 text-sm text-qms-dark outline-none transition-colors focus:border-qms-primary focus-visible:ring-0 disabled:opacity-65" />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-4 border-b border-qms-border py-4">
        <label htmlFor={id + '-asunto'} className="w-12 shrink-0 text-sm text-qms-muted">Asunto</label>
        <input id={id + '-asunto'} type="text" autoComplete="off" value={correo.asunto} maxLength={CORREO_QUEJA_LIMITES.asunto} required disabled={disabled}
          onChange={event => onChange({ ...correo, asunto: event.target.value })}
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm font-medium text-qms-dark outline-none placeholder:text-qms-muted focus-visible:ring-0 disabled:opacity-65"
          placeholder="Asunto del correo" />
      </div>
    </div>
    <div className="flex min-h-[16rem] flex-1 flex-col px-5 py-7 sm:px-8 sm:py-9">
      <label htmlFor={id + '-mensaje'} className="sr-only">Mensaje</label>
      <textarea ref={messageRef} id={id + '-mensaje'} value={correo.cuerpo} maxLength={CORREO_QUEJA_LIMITES.cuerpo} required disabled={disabled}
        onChange={event => onChange({ ...correo, cuerpo: event.target.value })}
        className="min-h-[16rem] w-full resize-none overflow-hidden border-0 bg-transparent text-base leading-[1.8] text-qms-dark outline-none placeholder:text-qms-muted focus-visible:ring-0 disabled:opacity-65"
        placeholder="Escriba su mensaje aquí..." />
      <span className="mt-4 text-right text-xs text-qms-muted">{correo.cuerpo.length} / {CORREO_QUEJA_LIMITES.cuerpo.toLocaleString('es-CR')}</span>
    </div>
  </section>
}
