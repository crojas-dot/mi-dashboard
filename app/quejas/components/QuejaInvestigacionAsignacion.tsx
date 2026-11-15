'use client'

import { FileText } from 'lucide-react'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import type { QuejaInvestigationAssignment } from '@/lib/queries/useQuejaInvestigationAssignment'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import RichTextContent from '@/components/ui/RichTextContent'
import { CaseSection } from './QuejaExpedientePanels'

/** Etapa 2 para Calidad: justificación, responsable y documentos de asignación. */
export default function QuejaInvestigacionAsignacion({
  responsable, responsableEmail, justificacionProcede, justificacionFormato, asignacion, asignacionLoading, asignacionError,
  adjuntos, adjuntosLoading, adjuntosError, onPreview, onDownload,
}: {
  responsable: string | null
  responsableEmail?: string | null
  justificacionProcede?: string | null
  justificacionFormato?: 'plain' | 'markdown'
  asignacion: QuejaInvestigationAssignment | null | undefined
  asignacionLoading: boolean
  asignacionError: boolean
  adjuntos: QuejaAdjunto[]
  adjuntosLoading: boolean
  adjuntosError: boolean
  onPreview: (adjunto: QuejaAdjunto) => void
  onDownload: (adjunto: QuejaAdjunto) => void
}) {
  const oficio = asignacion?.oficio_adjunto_id
    ? adjuntos.find(file => file.id === asignacion.oficio_adjunto_id)
    : null
  const otrosAdjuntos = adjuntos.filter(file => !!file.usuario_id && file.id !== oficio?.id)
  // La justificación de Calidad es la fuente principal; si un expediente antiguo
  // solo guardó instrucciones independientes, se muestran como respaldo.
  const justificacionPrincipal = justificacionProcede?.trim()
  const instrucciones = justificacionPrincipal || asignacion?.instrucciones?.trim() || ''
  const instruccionesFormato = justificacionPrincipal ? justificacionFormato ?? 'plain' : 'plain'
  const iniciales = responsable?.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase()).join('') || '—'
  return <CaseSection variant="document" title="Detalles de asignación">
    <div data-investigation-assignment className="space-y-5 text-sm">
      <section data-investigation-instructions aria-label="Justificación registrada"
        className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-4 text-[15px] leading-relaxed text-qms-dark">
        {instrucciones ? <RichTextContent value={instrucciones} format={instruccionesFormato} />
          : asignacionLoading ? <p className="text-sm text-qms-muted">Consultando detalles de la asignación…</p>
          : <p className="text-sm text-qms-muted">Sin justificación registrada para esta asignación.</p>}
      </section>
      {asignacionError && <p role="alert" className="text-sm text-qms-danger">No se pudieron consultar los archivos vinculados a la asignación.</p>}
      <div data-investigation-assignee className="flex items-center gap-3 rounded-lg border border-qms-border bg-gray-50 px-4 py-3.5">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{iniciales}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-qms-muted">Investigador asignado</p>
          <p className="mt-0.5 break-words font-semibold text-qms-dark">{responsable || 'Por asignar'}</p>
          <p data-investigation-assignee-email className="mt-1 break-all text-xs text-gray-500">{responsableEmail || 'Correo no registrado'}</p>
        </div>
      </div>
      {!!asignacion?.oficio_adjunto_id && <section data-investigation-office>
        <h4 className="mb-2 flex items-center gap-2 font-semibold text-qms-dark">
          <FileText aria-hidden="true" className="size-4 text-qms-primary" /> Oficio de apertura
        </h4>
        {adjuntosLoading ? <p className="text-qms-muted">Cargando oficio…</p>
          : adjuntosError ? <p role="alert" className="text-qms-danger">No se pudo consultar el oficio adjunto.</p>
          : oficio ? <ListaAdjuntos layout="cards" adjuntos={[oficio]} onPreview={onPreview} onDownload={onDownload} />
          : <p className="text-qms-muted">El oficio asociado ya no está disponible en el expediente.</p>}
      </section>}

      {!!otrosAdjuntos.length && <section data-investigation-other-files>
        <h4 className="mb-2 font-semibold text-qms-dark">Otros documentos del expediente</h4>
        <ListaAdjuntos layout="cards" adjuntos={otrosAdjuntos} onPreview={onPreview} onDownload={onDownload} />
      </section>}
    </div>
  </CaseSection>
}
