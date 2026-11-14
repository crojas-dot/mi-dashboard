'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileText, FolderOpen, UserRound } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import RichTextContent from '@/components/ui/RichTextContent'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import type { Queja } from '@/lib/types'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import type { QuejaActividad } from '@/lib/queries/useQuejaActividad'
import { queryKeys } from '@/lib/queries/queryKeys'
import { informePdfFilename } from '@/lib/utils/quejaInforme'
import { getQuejaAnalysis } from '@/lib/utils/quejaContent'
import { NOTA_APROBACION_GC, obtenerHistorialDevoluciones } from '@/lib/utils/quejaInvestigacionNotas'
import { caseDate } from './quejaExpedienteModel'

interface Props {
  queja: Queja
  adjuntos: QuejaAdjunto[]
  adjuntosLoading: boolean
  adjuntosError: boolean
  onRetryAdjuntos: () => void
  onPreview: (file: QuejaAdjunto) => void
  onDownload: (file: QuejaAdjunto) => void
  actividad: QuejaActividad[]
  actividadLoading: boolean
  actividadError: boolean
  responsable?: string
  resolveAuthor: (id: string) => string | undefined
}

const PASOS = [
  { id: 'cliente', title: 'Solicitud del cliente', Icon: UserRound, dot: 'bg-qms-primary', accent: 'text-qms-primary' },
  { id: 'investigacion', title: 'Propuesta de investigación', Icon: ClipboardCheck, dot: 'bg-qms-purple', accent: 'text-qms-purple' },
  { id: 'cierre', title: 'Resolución de Calidad', Icon: CheckCircle2, dot: 'bg-qms-success', accent: 'text-qms-success' },
] as const

/** Resumen de Resuelto: cada etapa muestra únicamente hechos vinculados al expediente real. */
export default function QuejaCierreResumen({ queja, adjuntos, adjuntosLoading, adjuntosError,
  onRetryAdjuntos, onPreview, onDownload, actividad, actividadLoading, actividadError, responsable, resolveAuthor }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const { data: informe, isLoading: informeLoading, isError: informeError } = useQuery({
    queryKey: [...queryKeys.quejas, 'informe', queja.id],
    queryFn: async ({ signal }) => {
      const { fetchQuejaInforme } = await import('@/lib/queries/useQuejaInforme')
      return fetchQuejaInforme(queja.id, signal)
    },
    enabled: !!queja.id,
    staleTime: 0,
    retry: false,
  })
  const analysis = getQuejaAnalysis(queja)
  const devoluciones = obtenerHistorialDevoluciones(actividad)
  const aprobacion = [...actividad].reverse().find(item => item.descripcion === NOTA_APROBACION_GC)
  const nombreAprobador = aprobacion?.usuario_id ? resolveAuthor(aprobacion.usuario_id) : undefined
  const pdfNombre = informe ? informePdfFilename(queja.folio, informe.version) : null
  const pdf = pdfNombre ? adjuntos.find(file => file.nombre === pdfNombre
    && file.tipo_mime.toLowerCase() === 'application/pdf' && !!file.usuario_id) : null
  const cliente = adjuntos.filter(file => !file.usuario_id)
  // No atribuir archivos institucionales históricos a una etapa que la DB no registra.
  const internos = adjuntos.filter(file => !!file.usuario_id && file.id !== pdf?.id)
  const archivos = selected === 0 ? cliente : selected === 1 ? internos : pdf ? [pdf] : []
  const cierre = aprobacion?.descripcion || (queja.estado === 'Finalizado' ? 'El expediente ha sido finalizado y conserva su resolución y evidencias.' : 'Propuesta aprobada por Gestión de Calidad. Pendiente de comunicar la respuesta final.')
  const textos = [queja.descripcion || 'Sin descripción registrada.', queja.resolucion || 'Sin propuesta registrada.', cierre]
  const estados = [queja.justificacion_procede ? 'Procedente' : 'Recibida', 'Propuesta registrada', queja.estado === 'Finalizado' ? 'Finalizado' : 'Resuelto · pendiente de envío']
  const fechas = [queja.fecha, null, aprobacion?.created_at ?? null]
  const paso = PASOS[selected ?? 0]

  return <>
    <section data-case-close-timeline className="@container min-w-0 px-4 py-4 sm:px-7 sm:py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-qms-border pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-qms-dark"><FolderOpen aria-hidden="true" className="size-4 text-qms-muted" />Resumen del expediente</h3>
      </div>
      <ol className="relative ml-4 space-y-3 border-l-[4px] border-qms-primary/15 pb-1">
        {PASOS.map((item, index) => {
          const Icon = item.Icon
          const cantidad = index === 0 ? cliente.length : index === 1 ? internos.length : pdf ? 1 : 0
          const tinta = index === 0 ? 'bg-qms-primary-soft/70' : index === 1 ? 'bg-qms-purple/10' : 'bg-qms-success/10'
          const estadoVisible = index === 2 ? (queja.estado === 'Finalizado' ? 'Finalizado' : 'Resuelto') : estados[index]
          return <li key={item.id} className="relative min-w-0 pl-7 sm:pl-8">
            <span aria-hidden="true" className={'absolute -left-[19px] top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-qms-surface shadow-sm ' + tinta}>
              <Icon className={'size-4 ' + item.accent} />
            </span>
            <button type="button" data-case-close-step={item.id} aria-label={'Ver detalle de ' + item.title}
              onClick={() => setSelected(index)}
              className="group flex min-h-[118px] w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-card border border-qms-border bg-qms-surface text-left transition-colors hover:border-qms-primary/40 hover:bg-qms-hover-bg/20 focus-visible:outline-2 focus-visible:outline-qms-primary @min-[580px]:h-[124px]">
              <div className={'flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-qms-border/70 px-3 py-2 sm:px-4 ' + tinta}>
                <h4 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-qms-dark group-hover:text-qms-primary">{item.title}</h4>
                {fechas[index] && <span className="text-xs text-qms-muted">{caseDate(fechas[index])}</span>}
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-1 px-3 py-2 sm:px-4">
                <div className="min-w-0">
                  <p className="line-clamp-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-qms-dark">{textos[index]}</p>
                  {index === 1 && responsable && <p className="mt-0.5 truncate text-xs text-qms-muted" title={responsable}>Por: {responsable}</p>}
                  {index === 2 && nombreAprobador && <p className="mt-0.5 truncate text-xs text-qms-muted" title={nombreAprobador}>Aprobado por: {nombreAprobador}</p>}
                </div>
                <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-qms-border/60 pt-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="rounded-button bg-qms-hover-bg px-1.5 py-0.5 text-xs font-medium text-qms-muted">{estadoVisible}</span>
                    {index === 1 && !actividadLoading && !actividadError && devoluciones.length > 0 && <span className="text-xs font-medium text-soft-amber-text">{devoluciones.length} {devoluciones.length === 1 ? 'devolución' : 'devoluciones'}</span>}
                    <span className="text-xs text-qms-muted">{adjuntosLoading ? 'Consultando archivos…' : adjuntosError ? 'Archivos no disponibles' : cantidad ? cantidad + (cantidad === 1 ? ' archivo' : ' archivos') : 'Sin archivos'}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-qms-primary group-hover:underline">Ver detalle <ArrowRight aria-hidden="true" className="size-3.5" /></span>
                </div>
              </div>
            </button>
          </li>
        })}
      </ol>
    </section>
    <Modal open={selected !== null} onClose={() => setSelected(null)} title={paso.title} titleSuffix={queja.folio}
      variant="document" size="mail" height="fill"
      footer={<div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="secondary" disabled={selected === 0}
          onClick={() => setSelected(current => current === null ? null : Math.max(0, current - 1))}><ChevronLeft aria-hidden="true" className="size-4" />Anterior</Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>
          <Button size="sm" disabled={selected === PASOS.length - 1}
            onClick={() => setSelected(current => current === null ? null : Math.min(PASOS.length - 1, current + 1))}>
            Siguiente paso <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>}>
      <div data-case-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg px-4 py-5 [will-change:transform] sm:px-8 sm:py-7">
        <article className="mx-auto w-full max-w-3xl rounded-card border border-qms-border bg-qms-surface p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-2 border-b border-qms-border pb-4">
            <div><h3 className="text-base font-semibold text-qms-dark">{paso.title}</h3>
              {fechas[selected ?? 0] && <p className="mt-1 text-xs text-qms-muted">{caseDate(fechas[selected ?? 0])}</p>}
              {selected === 1 && responsable && <p className="mt-1 text-xs text-qms-muted">Responsable asignado: {responsable}</p>}
              {selected === 2 && nombreAprobador && <p className="mt-1 text-xs text-qms-muted">Aprobado por: {nombreAprobador}</p>}
            </div>
            <span className="rounded-button bg-qms-primary-soft px-2 py-1 text-xs font-medium text-qms-primary">{estados[selected ?? 0]}</span>
          </div>
          {selected === 0 && <>
            <div data-case-reading-copy><h4 className="mb-2 text-sm font-semibold text-qms-dark">Descripción del cliente</h4>
              <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-qms-dark">{queja.descripcion || 'Sin descripción registrada.'}</p></div>
            {queja.justificacion_procede && <div data-case-reading-copy className="mt-6 border-t border-qms-border pt-5">
              <h4 className="mb-3 text-sm font-semibold text-qms-dark">Evaluación de Calidad</h4>
              <RichTextContent value={queja.justificacion_procede} format={queja.justificacion_procede_formato} />
            </div>}
          </>}
          {selected === 1 && <>
            <div data-case-reading-copy><h4 className="mb-3 text-sm font-semibold text-qms-dark">Propuesta del responsable</h4>
              {queja.resolucion ? <RichTextContent value={queja.resolucion} format={queja.resolucion_formato} /> : <p className="text-sm text-qms-muted">Sin propuesta registrada.</p>}
            </div>
            {analysis && <div data-case-reading-copy className="mt-6 border-t border-qms-border pt-5">
              <h4 className="mb-3 text-sm font-semibold text-qms-dark">Análisis registrado</h4>
              <RichTextContent value={analysis.value} format={analysis.format} />
            </div>}
            {actividadError ? <p role="alert" className="mt-5 text-sm text-qms-muted">No se pudo consultar el historial de devoluciones.</p>
              : actividadLoading ? <p role="status" className="mt-5 text-sm text-qms-muted">Consultando devoluciones…</p>
              : devoluciones.length > 0 && <section className="mt-6 rounded-card border border-qms-warning/30 bg-soft-amber-bg p-4">
                <h4 className="mb-3 text-sm font-semibold text-soft-amber-text">Correcciones solicitadas por Calidad</h4>
                <ol className="space-y-3">{devoluciones.map((item, index) => <li key={item.fecha + index} className="text-sm text-soft-amber-text">
                  <p className="mb-1 text-xs">{caseDate(item.fecha)}</p><p className="whitespace-pre-wrap break-words">{item.motivo}</p>
                </li>)}</ol>
              </section>}
          </>}
          {selected === 2 && <>
            <div className="rounded-card border border-qms-border bg-qms-hover-bg p-4">
              <h4 className="mb-2 text-sm font-semibold text-qms-dark">Revisión de Calidad</h4>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-qms-dark">{cierre}</p>
            </div>
            <p className="mt-4 text-sm text-qms-muted">Estado actual: Resuelto. La respuesta al cliente se prepara y publica por separado.</p>
            {informeLoading && <p role="status" className="mt-3 text-sm text-qms-muted">Consultando informe oficial…</p>}
            {informeError && <p role="alert" className="mt-3 text-sm text-qms-muted">No se pudo consultar el informe oficial.</p>}
          </>}
          <section className="mt-6 border-t border-qms-border pt-5">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-qms-dark">
              <FileText aria-hidden="true" className="size-4 text-qms-primary" />
              {selected === 0 ? 'Adjuntos del cliente' : selected === 1 ? 'Archivos internos del expediente' : 'PDF oficial de esta versión'}
            </h4>
            {selected === 1 && <p className="mb-3 text-xs text-qms-muted">No todos los archivos internos están vinculados exclusivamente a esta etapa.</p>}
            {adjuntosLoading ? <p role="status" className="text-sm text-qms-muted">Consultando adjuntos…</p>
              : adjuntosError ? <div role="alert" className="text-sm text-qms-muted">No se pudieron cargar. <Button size="sm" variant="link" onClick={onRetryAdjuntos}>Reintentar</Button></div>
              : archivos.length ? <ListaAdjuntos adjuntos={archivos} layout="modal" hideGroupTitle onPreview={onPreview} onDownload={onDownload} />
              : <p className="text-sm text-qms-muted">No hay archivos asociados para mostrar.</p>}
          </section>
        </article>
      </div>
    </Modal>
  </>
}
