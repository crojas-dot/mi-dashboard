'use client'

import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import RichTextContent from '@/components/ui/RichTextContent'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import AreaAfectada from '@/components/quejas/AreaAfectada'
import { CaseSection } from '@/app/quejas/components/QuejaExpedientePanels'
import { getQuejaAnalysis } from '@/lib/utils/quejaContent'
import type { Queja } from '@/lib/types'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import type { QuejaInvestigationAssignment } from '@/lib/queries/useQuejaInvestigationAssignment'

interface Props {
  queja: Queja
  asignacion?: QuejaInvestigationAssignment | null
  adjuntosCliente: QuejaAdjunto[]
  adjuntosCalidad: QuejaAdjunto[]
  adjuntosLoading: boolean
  adjuntosError: boolean
  onRetryAdjuntos: () => void
  onPreview: (adjunto: QuejaAdjunto) => void
  onDownload: (adjunto: QuejaAdjunto) => void
}

export default function QuejaAnalisisPanel({
  queja, asignacion, adjuntosCliente, adjuntosCalidad, adjuntosLoading, adjuntosError,
  onRetryAdjuntos, onPreview, onDownload,
}: Props) {
  const analysis = getQuejaAnalysis(queja)
  const noProcede = queja.estado === 'No Procede'
  const decision = noProcede ? 'No Procede' : queja.justificacion_procede ? 'Procede' : null
  const observacion = queja.justificacion_procede || (noProcede ? queja.resolucion : null)
  const formato = queja.justificacion_procede ? queja.justificacion_procede_formato : queja.resolucion_formato
  const instrucciones = asignacion?.instrucciones?.trim()
  const adjuntosProps = { layout: 'rows' as const, hideGroupTitle: true, onPreview, onDownload }

  return <div data-mis-quejas-analysis className="min-w-0 divide-y divide-qms-border">
    <div className="px-5 py-5 sm:px-8 sm:py-6">
      <section data-quality-review className="rounded-card border border-qms-warning/40 bg-soft-amber-bg px-4 py-3 text-soft-amber-text sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Evaluación de Calidad</h3>
          {decision && <Badge variant={noProcede ? 'gray' : 'blue'}>{decision}</Badge>}
        </div>
      {observacion ? <RichTextContent value={observacion} format={formato} />
        : <p className="text-sm">Sin observación de Calidad registrada.</p>}
      {instrucciones && instrucciones !== observacion?.trim() && <section className="mt-4 border-t border-qms-warning/30 pt-3">
        <h4 className="mb-2 text-sm font-semibold">Indicaciones para la investigación</h4>
        <p className="whitespace-pre-wrap wrap-anywhere text-sm">{instrucciones}</p>
      </section>}
      </section>
    </div>
    <CaseSection title="Descripción del cliente" variant="document" headerActions={<AreaAfectada area={queja.area_afectada} />}>
      <p data-client-description className="whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-qms-dark">{queja.descripcion || 'Sin descripción registrada.'}</p>
    </CaseSection>
    {analysis && <CaseSection title="Análisis registrado" variant="document">
      <RichTextContent value={analysis.value} format={analysis.format} />
    </CaseSection>}
    {queja.observaciones && <CaseSection title="Observación anterior" variant="document">
      <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed">{queja.observaciones}</p>
    </CaseSection>}
    <CaseSection title="Adjuntos" variant="document">
      {adjuntosLoading ? <LoadingSkeleton variant="list" label="Cargando adjuntos…" framed={false} />
        : adjuntosError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-qms-muted">
            No se pudieron consultar los adjuntos.<Button size="sm" variant="ghost" onClick={onRetryAdjuntos}>Reintentar</Button>
          </div> : <div className="space-y-4">
            <section>
              <h4 className="mb-2 text-sm font-medium">Evidencias del cliente</h4>
              {adjuntosCliente.length ? <ListaAdjuntos {...adjuntosProps} adjuntos={adjuntosCliente} />
                : <p className="text-sm text-qms-muted">Sin adjuntos del cliente.</p>}
            </section>
            {adjuntosCalidad.length > 0 && <section>
              <h4 className="mb-2 text-sm font-medium">Archivos de Calidad y antecedentes</h4>
              <ListaAdjuntos {...adjuntosProps} adjuntos={adjuntosCalidad} />
            </section>}
          </div>}
    </CaseSection>
  </div>
}
