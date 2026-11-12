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
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// Un motivo mayor a dos líneas se resume en línea y se consulta completo al abrir el modal.
const LONGITUD_MOTIVO_PREVIEW = 140

export default function QuejaInvestigacionResumen({ devolucion, open, onOpenChange }: Props) {
  const [verMotivoInterno, setVerMotivoInterno] = useState(false)
  const verMotivo = open ?? verMotivoInterno
  const cambiarVerMotivo = onOpenChange ?? setVerMotivoInterno
  if (!devolucion) return null
  const largo = devolucion.motivo.trim().length > LONGITUD_MOTIVO_PREVIEW
  return (
    <>
      <section data-investigation-return className="min-w-0 rounded-card bg-soft-amber-bg p-4 text-sm text-soft-amber-text">
        <p className="mb-1 flex items-start gap-2 font-medium"><CornerDownLeft aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>Devolución de Calidad <time className="block font-normal" dateTime={devolucion.fecha}>{caseDate(devolucion.fecha)}</time></span></p>
        <p className={largo ? 'whitespace-pre-wrap break-words leading-relaxed' : 'line-clamp-2 whitespace-pre-wrap break-words leading-relaxed'}>{devolucion.motivo}</p>
        {largo && <Button className="mt-2" size="sm" variant="secondary" onClick={() => cambiarVerMotivo(true)}>Ver más</Button>}
      </section>
      <Modal open={verMotivo} onClose={() => cambiarVerMotivo(false)} title="Devolución de Calidad" size="md">
        <div className="rounded-card bg-soft-amber-bg p-4 text-sm text-soft-amber-text">
          <time dateTime={devolucion.fecha}>{caseDate(devolucion.fecha)}</time>
          <p className="mt-2 whitespace-pre-wrap break-words">{devolucion.motivo}</p>
        </div>
      </Modal>
    </>
  )
}
