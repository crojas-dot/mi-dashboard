'use client'

import { useState } from 'react'
import { CornerDownLeft } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import { caseDate } from '@/app/quejas/components/quejaExpedienteModel'

export interface DevolucionInvestigacion {
  motivo: string
  fecha: string
}

interface Props {
  devolucion?: DevolucionInvestigacion
  devoluciones?: readonly DevolucionInvestigacion[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const LONGITUD_MOTIVO_PREVIEW = 140

export default function QuejaInvestigacionResumen({ devolucion, devoluciones, open, onOpenChange }: Props) {
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
      <section data-investigation-return className="min-w-0 rounded-card bg-soft-amber-bg p-4 text-sm text-soft-amber-text">
        <p className="mb-1 flex items-start gap-2 font-medium"><CornerDownLeft aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>Devolución de Calidad <time className="block font-normal" dateTime={reciente.fecha}>{caseDate(reciente.fecha)}</time></span></p>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{vistaPrevia}</p>
        {historial.length > 1 && <p className="mt-2 text-xs">{historial.length} devoluciones registradas</p>}
        {verMas && <Button className="mt-2" size="sm" variant="secondary" onClick={() => cambiarVerMotivo(true)}>Ver más</Button>}
      </section>
      <Modal open={verMotivo} onClose={() => cambiarVerMotivo(false)} title="Devoluciones de Calidad" size="md" height="content">
        <ol className="space-y-3">
          {historial.map((item, index) => (
            <li key={item.fecha + '-' + index} className="rounded-card bg-soft-amber-bg p-4 text-sm text-soft-amber-text">
              <p className="mb-2 flex flex-wrap items-center justify-between gap-2 font-medium">
                <span>{index === 0 ? 'Devolución más reciente' : 'Devolución anterior'}</span>
                <time className="font-normal" dateTime={item.fecha}>{caseDate(item.fecha)}</time>
              </p>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{item.motivo}</p>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  )
}
