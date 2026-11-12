import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import RichTextContent from '@/components/ui/RichTextContent'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import AreaAfectada from '@/components/quejas/AreaAfectada'
import { CaseRequestHeader, CaseSection } from '@/app/quejas/components/QuejaExpedientePanels'
import { caseDate } from '@/app/quejas/components/quejaExpedienteModel'
import { getQuejaAnalysis } from '@/lib/utils/quejaContent'
import type { Queja } from '@/lib/types'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import type { QuejaActividad } from '@/lib/queries/useQuejaActividad'
import type { DevolucionInvestigacion } from '@/app/mis-quejas/components/QuejaInvestigacionResumen'

interface Props {
  queja: Queja
  open: boolean
  onClose: () => void
  onPrepararResolucion?: () => void
  devolucion?: DevolucionInvestigacion
  adjuntos: QuejaAdjunto[]
  adjuntosLoading: boolean
  adjuntosError: boolean
  onRetryAdjuntos: () => void
  onPreview: (adjunto: QuejaAdjunto) => void
  onDownload: (adjunto: QuejaAdjunto) => void
  actividad: QuejaActividad[]
  actividadLoading: boolean
  actividadError: boolean
  onRetryActividad: () => void
}

// Solo lectura; comparte los datos cargados por la investigación y su mismo visor.
export default function QuejaAnalisisPanel(props: Props) {
  const { queja } = props
  const analysis = getQuejaAnalysis(queja)
  const decision = queja.estado === 'No Procede' ? 'No Procede' : queja.justificacion_procede ? 'Procede' : null
  return <Modal open={props.open} onClose={props.onClose} title={`Análisis · ${queja.folio}`} variant="document" size="xl"
    footer={<div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={props.onClose}>Cerrar</Button>{props.onPrepararResolucion && <Button className="min-w-0 whitespace-normal" onClick={props.onPrepararResolucion}>Preparar resolución</Button>}</div>}>
    <div data-analysis-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg [will-change:transform]">
      <div className="mx-auto w-full min-w-0 max-w-5xl p-4 sm:p-6">
        <div className="divide-y divide-qms-border rounded-card border border-qms-border bg-qms-surface">
          <CaseSection title="Observación de Calidad" variant="document" headerActions={decision && <Badge variant={decision === 'Procede' ? 'blue' : 'gray'}>{decision}</Badge>}>{queja.justificacion_procede ? <RichTextContent value={queja.justificacion_procede} format={queja.justificacion_procede_formato} /> : <p className="text-sm text-qms-muted">Sin observación registrada.</p>}</CaseSection>
          <CaseSection title="Descripción del cliente" variant="document" headerActions={<AreaAfectada area={queja.area_afectada} />}><p className="whitespace-pre-wrap break-words text-base leading-relaxed">{queja.descripcion || 'Sin descripción.'}</p></CaseSection>
          {props.devolucion && <CaseSection title="Devolución de Calidad" variant="document"><div className="rounded-card bg-soft-amber-bg p-3 text-sm text-soft-amber-text"><time dateTime={props.devolucion.fecha}>{caseDate(props.devolucion.fecha)}</time><p className="mt-2 whitespace-pre-wrap break-words">{props.devolucion.motivo}</p></div></CaseSection>}
          {analysis && <CaseSection title="Análisis registrado" source="Gestión interna" variant="document"><RichTextContent value={analysis.value} format={analysis.format} /></CaseSection>}
          <CaseSection title="Archivos del expediente" variant="document">
            {props.adjuntosLoading ? <LoadingSkeleton variant="list" label="Cargando archivos…" framed={false} /> : props.adjuntosError ? <div role="alert"><p>No se pudieron cargar los archivos.</p><Button variant="ghost" size="sm" onClick={props.onRetryAdjuntos}>Reintentar archivos</Button></div> : props.adjuntos.length ? <ListaAdjuntos adjuntos={props.adjuntos} layout="cards" onPreview={props.onPreview} onDownload={props.onDownload} /> : <p className="text-sm text-qms-muted">Sin archivos registrados.</p>}
          </CaseSection>
          {(queja.resolucion || queja.numero_oficio_resolucion) && <CaseSection title={queja.estado === 'En Investigación' ? 'Propuesta anterior registrada' : 'Documento registrado'} source="Responsable" variant="document">
            {queja.resolucion && <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} />}
            {queja.numero_oficio_resolucion && <p className="mt-3 text-sm text-qms-muted">N.º de oficio: {queja.numero_oficio_resolucion}</p>}
          </CaseSection>}
          {queja.observaciones && <CaseSection title="Observación anterior" variant="document"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{queja.observaciones}</p></CaseSection>}
          <CaseSection title="Historial" variant="document">
            {props.actividadLoading ? <LoadingSkeleton variant="list" label="Cargando historial…" framed={false} /> : props.actividadError ? <div role="alert"><p>No se pudo cargar el historial.</p><Button variant="ghost" size="sm" onClick={props.onRetryActividad}>Reintentar historial</Button></div> : props.actividad.length ? <ol className="space-y-4">{props.actividad.map(item => <li key={item.id}><div className="flex flex-wrap justify-between gap-2 text-xs text-qms-muted"><span>{item.tipo}</span><time dateTime={item.created_at}>{caseDate(item.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.descripcion}</p></li>)}</ol> : <p className="text-sm text-qms-muted">Sin actividad registrada.</p>}
          </CaseSection>
        </div>
        <div className="mt-4"><CaseRequestHeader queja={queja} variant="panel" reference /></div>
      </div>
    </div>
  </Modal>
}
