'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock3, FileText, LockKeyhole, Paperclip } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import RichTextContent from '@/components/ui/RichTextContent'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import AreaAfectada from '@/components/quejas/AreaAfectada'
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

type AnalysisTab = 'analisis' | 'adjuntos' | 'historial'

const tabs = [
  { id: 'analisis', label: 'Análisis', Icon: FileText },
  { id: 'adjuntos', label: 'Adjuntos', Icon: Paperclip },
  { id: 'historial', label: 'Historial', Icon: Clock3 },
] as const

export default function QuejaAnalisisPanel(props: Props) {
  const { queja } = props
  const [activeTab, setActiveTab] = useState<AnalysisTab>('analisis')
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (props.open) setActiveTab('analisis')
  }, [props.open, queja.id])

  const analysis = getQuejaAnalysis(queja)
  const adjuntosCliente = props.adjuntos.filter(adjunto => !adjunto.usuario_id)
  const decision = queja.estado === 'No Procede' ? 'No Procede' : queja.justificacion_procede ? 'Procede' : null
  const tabId = (id: AnalysisTab) => `analisis-${queja.id}-${id}`
  const changeTab = (id: AnalysisTab) => {
    setActiveTab(id)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const tabButtons = (mobile: boolean) => <div role="tablist" aria-label="Secciones del análisis" className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-button bg-qms-hover-bg p-1">
    {tabs.map(({ id, label, Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} aria-controls={tabId(id)}
      onClick={() => changeTab(id)}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-button px-3 py-2 text-xs font-medium transition-colors ${activeTab === id ? 'bg-qms-surface font-semibold text-qms-primary shadow-sm' : 'text-qms-muted hover:bg-qms-surface hover:text-qms-dark'} ${mobile ? 'min-h-10' : ''}`}>
      <Icon aria-hidden="true" className="size-3.5" />{label}
      {id === 'adjuntos' && !props.adjuntosLoading && !props.adjuntosError && <span className="rounded-button bg-qms-neutral-soft px-1.5 py-0.5 text-[11px] font-semibold text-qms-muted">{adjuntosCliente.length}</span>}
    </button>)}
  </div>

  return <Modal open={props.open} onClose={props.onClose} title="Análisis del caso" titleSuffix={queja.folio} variant="document" size="xl" emphasizeTitle
    headerActions={<div className="hidden min-w-0 items-center gap-3 md:flex">{tabButtons(false)}<span aria-hidden="true" className="h-5 w-px shrink-0 bg-qms-border" /></div>}
    footer={<div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={props.onClose}>Cerrar</Button>{props.onPrepararResolucion && <Button className="min-w-0 whitespace-normal" onClick={props.onPrepararResolucion}>Preparar resolución</Button>}</div>}>
    <div className="shrink-0 border-b border-qms-border bg-qms-surface px-3 py-2 md:hidden">{tabButtons(true)}</div>
    <div ref={scrollRef} data-analysis-scroll className="qms-compact-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg">
      <section id={tabId('analisis')} role="tabpanel" aria-label="Análisis" hidden={activeTab !== 'analisis'} className={activeTab === 'analisis' ? 'mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 p-4 sm:p-6' : 'hidden'}>
        <div data-quality-review className="relative mb-1">
          <div className="relative z-10 rounded-card border border-qms-warning/50 bg-soft-amber-bg p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-button border border-qms-warning/50 bg-soft-amber-bg font-semibold text-sm text-soft-amber-text">GC</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-qms-dark">Evaluación de Calidad</h3>
                  <p className="mt-1 text-xs text-qms-muted">Observación registrada en el expediente</p>
                </div>
              </div>
              {decision && <Badge variant={decision === 'Procede' ? 'blue' : 'gray'}>{decision}</Badge>}
            </div>
            {queja.justificacion_procede
              ? <div className="break-words text-base leading-relaxed text-qms-dark"><RichTextContent value={queja.justificacion_procede} format={queja.justificacion_procede_formato} /></div>
              : <p className="text-sm text-qms-muted">Sin observación de Calidad registrada.</p>}
          </div>
          <span aria-hidden="true" className="absolute bottom-[-6px] left-10 z-20 size-3 rotate-45 border-r border-b border-qms-warning/50 bg-soft-amber-bg" />
        </div>
        <section data-client-description className="min-w-0 rounded-card border border-qms-border bg-qms-surface p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-qms-dark"><FileText aria-hidden="true" className="size-5 text-qms-muted" />Descripción del cliente</h3>
            <AreaAfectada area={queja.area_afectada} />
          </div>
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-qms-dark">{queja.descripcion || 'Sin descripción registrada.'}</p>
        </section>
        {props.devolucion && <section className="rounded-card border border-qms-warning/50 bg-qms-surface p-5 shadow-sm sm:p-6">
          <h3 className="mb-2 text-sm font-semibold">Devolución de Calidad</h3>
          <time className="text-xs text-qms-muted" dateTime={props.devolucion.fecha}>{caseDate(props.devolucion.fecha)}</time>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{props.devolucion.motivo}</p>
        </section>}
        {analysis && <section className="rounded-card border border-qms-border bg-qms-surface p-5 shadow-sm sm:p-6">
          <h3 className="mb-3 text-sm font-semibold">Análisis registrado</h3>
          <RichTextContent value={analysis.value} format={analysis.format} />
        </section>}
        {(queja.resolucion || queja.numero_oficio_resolucion) && <section className="rounded-card border border-qms-border bg-qms-surface p-5 shadow-sm sm:p-6">
          <h3 className="mb-3 text-sm font-semibold">{queja.estado === 'En Investigación' ? 'Propuesta anterior registrada' : 'Documento registrado'}</h3>
          {queja.resolucion && <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} />}
          {queja.numero_oficio_resolucion && <p className="mt-3 text-sm text-qms-muted">N.º de oficio: {queja.numero_oficio_resolucion}</p>}
        </section>}
        {queja.observaciones && <section className="rounded-card border border-qms-border bg-qms-surface p-5 shadow-sm sm:p-6">
          <h3 className="mb-3 text-sm font-semibold">Observación anterior</h3>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{queja.observaciones}</p>
        </section>}
      </section>
      <section id={tabId('adjuntos')} role="tabpanel" aria-label="Adjuntos del cliente" hidden={activeTab !== 'adjuntos'} className={activeTab === 'adjuntos' ? 'mx-auto w-full min-w-0 max-w-5xl p-4 sm:p-6' : 'hidden'}>
        <div className="overflow-hidden rounded-card border border-qms-border bg-qms-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-qms-border bg-qms-hover-bg px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Evidencias del cliente</h3>
              <span className="rounded-button bg-qms-neutral-soft px-2 py-0.5 text-xs font-medium text-qms-muted">Solo lectura</span>
            </div>
            {!props.adjuntosLoading && !props.adjuntosError && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-qms-muted"><LockKeyhole aria-hidden="true" className="size-3.5" />{adjuntosCliente.length} {adjuntosCliente.length === 1 ? 'archivo' : 'archivos'}</span>}
          </div>
          {props.adjuntosLoading ? <div className="p-5"><LoadingSkeleton variant="list" label="Cargando archivos del cliente…" framed={false} /></div>
            : props.adjuntosError ? <div role="alert" className="flex flex-wrap items-center gap-2 p-5 text-sm text-qms-muted">No se pudieron cargar los archivos.<Button variant="ghost" size="sm" onClick={props.onRetryAdjuntos}>Reintentar archivos</Button></div>
            : adjuntosCliente.length ? <ListaAdjuntos adjuntos={adjuntosCliente} layout="rows" hideGroupTitle onPreview={props.onPreview} onDownload={props.onDownload} />
            : <p className="p-5 text-sm text-qms-muted">Sin adjuntos del cliente.</p>}
        </div>
      </section>
      <section id={tabId('historial')} role="tabpanel" aria-label="Historial del expediente" hidden={activeTab !== 'historial'} className={activeTab === 'historial' ? 'mx-auto w-full min-w-0 max-w-5xl p-4 sm:p-6' : 'hidden'}>
        <div className="rounded-card border border-qms-border bg-qms-surface p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Clock3 aria-hidden="true" className="size-5 text-qms-muted" />Línea de tiempo</h3>
            <span className="rounded-button border border-qms-border bg-qms-hover-bg px-2 py-1 text-xs text-qms-muted">Actividad registrada</span>
          </div>
          {props.actividadLoading ? <LoadingSkeleton variant="list" label="Cargando historial…" framed={false} />
            : props.actividadError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-qms-muted">No se pudo cargar el historial.<Button size="sm" variant="ghost" onClick={props.onRetryActividad}>Reintentar historial</Button></div>
            : props.actividad.length ? <ol className="ml-4 space-y-6 border-l-2 border-qms-border pb-2">
                {[...props.actividad].reverse().map(item => <li key={item.id} className="relative pl-7">
                  <span aria-hidden="true" className="absolute -left-3 top-0 flex size-6 items-center justify-center rounded-full border-2 border-qms-primary bg-qms-surface text-qms-primary"><Clock3 className="size-3" /></span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.tipo === 'nota' ? 'Nota registrada' : item.tipo}</p>
                    <time className="text-xs text-qms-muted" dateTime={item.created_at}>{caseDate(item.created_at)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-card border border-qms-border bg-qms-hover-bg p-3 text-sm leading-relaxed">{item.descripcion}</p>
                </li>)}
              </ol> : <p className="text-sm text-qms-muted">Sin actividad registrada.</p>}
        </div>
      </section>
    </div>
  </Modal>
}
