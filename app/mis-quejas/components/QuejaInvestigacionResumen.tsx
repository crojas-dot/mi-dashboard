'use client'

import { useState } from 'react'
import { CornerDownLeft, Eye, FileText, Pencil, Paperclip } from 'lucide-react'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { caseDate } from '@/app/quejas/components/quejaExpedienteModel'

export interface DevolucionInvestigacion {
  motivo: string
  fecha: string
  adjuntoIds?: string[]
}

interface Props {
  devolucion?: DevolucionInvestigacion
  devoluciones?: readonly DevolucionInvestigacion[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  folio?: string
  archivos?: readonly QuejaAdjunto[]
  onPreview?: (archivo: QuejaAdjunto) => void
  onEditor?: () => void
}

const LONGITUD_MOTIVO_PREVIEW = 140

export default function QuejaInvestigacionResumen({ devolucion, devoluciones, open, onOpenChange, folio, archivos = [], onPreview, onEditor }: Props) {
  const [verMotivoInterno, setVerMotivoInterno] = useState(false)
  const verMotivo = open ?? verMotivoInterno
  const cambiarVerMotivo = onOpenChange ?? setVerMotivoInterno
  const historial = (devoluciones?.length ? [...devoluciones] : devolucion ? [devolucion] : [])
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  const reciente = historial[0]
  if (!reciente) return null

  const largo = reciente.motivo.trim().length > LONGITUD_MOTIVO_PREVIEW
  const vistaPrevia = largo
    ? reciente.motivo.trim().slice(0, LONGITUD_MOTIVO_PREVIEW).trimEnd() + '…'
    : reciente.motivo
  const verMas = largo || historial.length > 1

  return (
    <>
      <button type="button" data-investigation-return aria-label="Ver detalle de la devolución de Calidad" onClick={() => cambiarVerMotivo(true)} className="w-full min-w-0 cursor-pointer rounded-card border border-qms-warning/30 bg-soft-amber-bg p-4 text-left text-sm text-soft-amber-text hover:border-qms-warning focus-visible:outline-2 focus-visible:outline-qms-primary">
        <p className="mb-1 flex items-start gap-2 font-medium"><CornerDownLeft aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>Devolución de Calidad <time className="block font-normal" dateTime={reciente.fecha}>{caseDate(reciente.fecha)}</time></span></p>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{vistaPrevia}</p>
        {historial.length > 1 && <p className="mt-2 text-xs">{historial.length} devoluciones registradas</p>}
        <span className="mt-3 inline-flex items-center gap-2 font-medium"><Eye aria-hidden="true" className="size-4" />{verMas ? 'Ver más' : 'Ver detalle'}</span>
      </button>
      <Modal open={verMotivo} onClose={() => cambiarVerMotivo(false)} title="Devolución de Calidad" titleSuffix={folio} headerLeading={<CornerDownLeft aria-hidden="true" className="size-4 text-qms-warning" />} size="mail" variant="document"
        footer={<div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-qms-muted">La propuesta se corrige en el editor principal.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => cambiarVerMotivo(false)}>Cerrar</Button>
            {onEditor && <Button onClick={() => { cambiarVerMotivo(false); onEditor() }}><Pencil aria-hidden="true" className="size-4" />Ir al editor</Button>}
          </div>
        </div>}>
        <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-qms-surface p-5 sm:p-8">
          {historial.map((item, index) => (
            <li key={item.fecha + '-' + index} className="rounded-card border border-qms-warning/30 bg-soft-amber-bg p-5 text-sm leading-relaxed text-soft-amber-text">
              <p className="mb-2 flex flex-wrap items-center justify-between gap-2 font-medium">
                <span>{index === 0 ? 'Devolución más reciente' : 'Devolución anterior'}</span>
                <time className="font-normal" dateTime={item.fecha}>{caseDate(item.fecha)}</time>
              </p>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{item.motivo}</p>
              {item.adjuntoIds && item.adjuntoIds.length > 0 && <div className="mt-4 border-t border-qms-warning/30 pt-3">
                <h4 className="mb-2 flex items-center gap-2 font-semibold"><Paperclip aria-hidden="true" className="size-4" />Soportes de esta devolución</h4>
                <ul className="space-y-2">{archivos.filter(file => item.adjuntoIds?.includes(file.id)).map(file => <li key={file.id} className="flex min-w-0 items-center justify-between gap-2 rounded-button bg-qms-surface px-3 py-2 text-qms-dark">
                  <span className="flex min-w-0 items-center gap-2"><FileText aria-hidden="true" className="size-4 shrink-0" /><span className="truncate" title={file.nombre}>{file.nombre}</span></span>
                  {onPreview && <Button size="sm" variant="ghost" aria-label={'Previsualizar ' + file.nombre} onClick={() => onPreview(file)}><Eye aria-hidden="true" className="size-4" />Ver</Button>}
                </li>)}</ul>
              </div>}
            </li>
          ))}
        </ol>
      </Modal>
    </>
  )
}
