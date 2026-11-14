'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileText, FolderOpen, UserRound } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import RichTextContent from '@/components/ui/RichTextContent'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import type { Queja } from '@/lib/types'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import type { QuejaActividad } from '@/lib/queries/useQuejaActividad'
import { useQuejaInforme } from '@/lib/queries/useQuejaInforme'
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
  const { data: informe, isLoading: informeLoading, isError: informeError } = useQuejaInforme(queja.id)
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
  const cierre = aprobacion?.descripcion || 'Propuesta aprobada por Gestión de Calidad. Pendiente de comunicar la respuesta final.'
  const textos = [queja.descripcion || 'Sin descripción registrada.', queja.resolucion || 'Sin propuesta registrada.', cierre]
  const estados = [queja.justificacion_procede ? 'Procedente' : 'Recibida', 'Propuesta registrada', 'Resuelto · pendiente de envío']
  const fechas = [queja.fecha, null, aprobacion?.created_at ?? null]
  const paso = PASOS[selected ?? 0]

  return <>
    <section data-case-close-timeline className="@container min-w-0 px-4 py-5 sm:px-8 sm:py-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-qms-border pb-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-qms-dark"><FolderOpen aria-hidden="true" className="size-4 text-qms-muted" />Resumen del expediente</h3>
      </div>
      <ol className="relative ml-3 space-y-5 border-l-2 border-qms-border pb-2">
        {PASOS.map((item, index) => {
          const Icon = item.Icon
          const cantidad = index === 0 ? cliente.length : index === 1 ? internos.length : pdf ? 1 : 0
          const etiqueta = index === 0 ? 'Solicitud' : index === 1 ? 'Análisis' : 'Calidad'
          const estadoVisible = index === 2 ? 'Resuelto' : estados[index]
          return <li key={item.id} className="relative pl-5 @min-[620px]:pl-7">
            <span aria-hidden="true" className={'absolute -left-[9px] top-1/2 z-10 size-4 -translate-y-1/2 rounded-full ring-4 ring-qms-surface ' + item.dot} />
            <button type="button" data-case-close-step={item.id} aria-label={'Ver detalle de ' + item.title}
              onClick={() => setSelected(index)}
              className="group flex min-h-[150px] w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-card border border-qms-border bg-qms-surface text-left shadow-sm transition-colors hover:border-qms-primary/40 focus-visible:outline-2 focus-visible:outline-qms-primary @min-[620px]:h-[150px] @min-[620px]:flex-row">
              <div className="flex min-w-0 flex-col justify-center gap-1.5 border-b border-qms-border bg-qms-hover-bg/40 px-4 py-3 @min-[620px]:w-[200px] @min-[620px]:shrink-0 @min-[620px]:border-r @min-[620px]:border-b-0 @min-[620px]:p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-qms-dark group-hover:text-qms-primary">
                  <Icon aria-hidden="true" className={'size-4 shrink-0 ' + item.accent} />{etiqueta}
                </h4>
                {fechas[index] && <p className="text-xs text-qms-muted">{caseDate(fechas[index])}</p>}
                {index === 1 && responsable && <p className="truncate text-xs text-qms-muted" title={responsable}>Por: {responsable}</p>}
                {index === 2 && nombreAprobador && <p className="truncate text-xs text-qms-muted" title={nombreAprobador}>Aprobado por: {nombreAprobador}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={'inline-flex max-w-full rounded-button px-2 py-0.5 text-[11px] font-medium ' + (index === 2 ? 'bg-soft-green-bg text-qms-success' : index === 0 ? 'bg-qms-primary-soft text-qms-primary' : 'bg-qms-hover-bg text-qms-muted')}>{estadoVisible}</span>
                  {index === 1 && !actividadLoading && !actividadError && devoluciones.length > 0 &&
                    <span className="text-[11px] font-medium text-soft-amber-text">{devoluciones.length} {devoluciones.length === 1 ? 'devolución' : 'devoluciones'}</span>}
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-2 px-4 py-3 @min-[620px]:p-4">
                <p className="line-clamp-3 min-w-0 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-qms-dark">{textos[index]}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-qms-muted">{adjuntosLoading ? 'Consultando archivos…' : adjuntosError ? 'Archivos no disponibles' : cantidad ? cantidad + (cantidad === 1 ? ' archivo' : ' archivos') : 'Sin archivos vinculados'}</span>
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
