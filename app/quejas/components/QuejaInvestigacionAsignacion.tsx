'use client'

import { FileText, UserRound, Clock3, ClipboardList } from 'lucide-react'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import type { QuejaResolucionDraft } from '@/lib/queries/useQuejaResolucionDraft'
import type { QuejaInvestigationAssignment } from '@/lib/queries/useQuejaInvestigationAssignment'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import RichTextContent from '@/components/ui/RichTextContent'
import { CaseSection } from './QuejaExpedientePanels'
import { caseDate } from './quejaExpedienteModel'

/** Etapa 2 para Calidad: asignación y progreso, nunca la evaluación anterior. */
export default function QuejaInvestigacionAsignacion({
  responsable, justificacionProcede, justificacionFormato, asignacion, asignacionLoading, asignacionError,
  borrador, borradorLoading, borradorError,
  adjuntos, adjuntosLoading, adjuntosError, onPreview, onDownload,
}: {
  responsable: string | null
  justificacionProcede?: string | null
  justificacionFormato?: 'plain' | 'markdown'
  asignacion: QuejaInvestigationAssignment | null | undefined
  asignacionLoading: boolean
  asignacionError: boolean
  borrador: QuejaResolucionDraft | null | undefined
  borradorLoading: boolean
  borradorError: boolean
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
  // Expedientes previos pueden conservar instrucciones independientes; para los nuevos
  // la única fuente es la justificación guardada durante Procede.
  const instruccionesAnteriores = asignacion?.instrucciones?.trim()
  const instrucciones = instruccionesAnteriores || justificacionProcede?.trim() || ''
  const instruccionesFormato = instruccionesAnteriores ? 'plain' : justificacionFormato ?? 'plain'
  return <CaseSection variant="document" source="Gestión de Calidad" title="Detalles de asignación">
    <div data-investigation-assignment className="space-y-5 text-sm">
      <div className="flex items-start gap-3 rounded-md border border-qms-border bg-qms-hover-bg/50 px-4 py-3.5">
        <UserRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-qms-primary" />
        <div className="min-w-0">
          <p className="text-xs text-qms-muted">Investigador asignado</p>
          <p className="mt-1 break-words font-semibold text-qms-dark">{responsable || 'Por asignar'}</p>
        </div>
      </div>

      {instrucciones ? <section data-investigation-instructions>
          <h4 className="mb-2 flex items-center gap-2 font-semibold text-qms-dark">
            <ClipboardList aria-hidden="true" className="size-4 text-qms-primary" /> Justificación e instrucciones de Calidad
          </h4>
          <RichTextContent value={instrucciones} format={instruccionesFormato} />
        </section> : asignacionLoading ? <p className="text-sm text-qms-muted">Consultando detalles de la asignación…</p>
        : <p className="text-sm text-qms-muted">Sin instrucciones registradas para esta asignación.</p>}
      {asignacionError && <p role="alert" className="text-sm text-qms-danger">No se pudieron consultar los archivos vinculados a la asignación.</p>}

      {!!asignacion?.oficio_adjunto_id && <section data-investigation-office>
        <h4 className="mb-2 flex items-center gap-2 font-semibold text-qms-dark">
          <FileText aria-hidden="true" className="size-4 text-qms-primary" /> Oficio de apertura
        </h4>
        {adjuntosLoading ? <p className="text-qms-muted">Cargando oficio…</p>
          : adjuntosError ? <p role="alert" className="text-qms-danger">No se pudo consultar el oficio adjunto.</p>
          : oficio ? <ListaAdjuntos layout="cards" adjuntos={[oficio]} onPreview={onPreview} onDownload={onDownload} />
          : <p className="text-qms-muted">El oficio asociado ya no está disponible en el expediente.</p>}
      </section>}

      <section data-investigation-draft className="rounded-md border border-qms-border bg-qms-surface px-4 py-3.5">
        <div className="flex items-start gap-3">
          <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-qms-primary" />
          <div className="min-w-0">
            {borradorLoading ? <p className="text-qms-muted">Comprobando progreso del investigador…</p>
              : borradorError ? <p role="alert" className="text-qms-danger">No se pudo comprobar el estado del borrador.</p>
              : borrador ? <>
                  <p className="font-semibold text-qms-dark">El investigador tiene un borrador en curso</p>
                  <p className="mt-1 text-qms-muted">Última modificación: <time dateTime={borrador.updated_at}>{caseDate(borrador.updated_at)}</time></p>
                  <p className="mt-1 text-xs text-qms-muted">Aún no se ha enviado a Revisión GC.</p>
                </> : <p className="text-qms-muted">Aún no hay un borrador guardado por el investigador.</p>}
          </div>
        </div>
      </section>

      {!!otrosAdjuntos.length && <section data-investigation-other-files>
        <h4 className="mb-2 font-semibold text-qms-dark">Otros documentos del expediente</h4>
        <ListaAdjuntos layout="cards" adjuntos={otrosAdjuntos} onPreview={onPreview} onDownload={onDownload} />
      </section>}
    </div>
  </CaseSection>
}
