'use client'

import { useRef, type DragEvent } from 'react'
import { ChevronRight, FileText, Paperclip, Upload } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ListaAdjuntos from '@/components/quejas/ListaAdjuntos'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'

type OnFiles = (files: File[]) => void

function dropHandlers(canUpload: boolean, onFiles: OnFiles) {
  const isFileDrag = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes('Files')
  return {
    onDragOver(event: DragEvent<HTMLElement>) {
      if (!isFileDrag(event)) return
      // Incluso cuando no se permite subir, impedir que el navegador abra
      // el archivo soltado y haga perder el documento sin guardar.
      event.preventDefault()
      event.dataTransfer.dropEffect = canUpload ? 'copy' : 'none'
      if (canUpload) event.currentTarget.dataset.dragging = 'true'
    },
    onDragLeave(event: DragEvent<HTMLElement>) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        delete event.currentTarget.dataset.dragging
      }
    },
    onDrop(event: DragEvent<HTMLElement>) {
      delete event.currentTarget.dataset.dragging
      if (!event.dataTransfer.files.length) return
      event.preventDefault()
      event.stopPropagation()
      if (canUpload) onFiles(Array.from(event.dataTransfer.files))
    },
  }
}

interface CardProps {
  adjuntos: QuejaAdjunto[]
  loading: boolean
  error: boolean
  onOpen: () => void
}

export function QuejaAdjuntosCard({ adjuntos, loading, error, onOpen }: CardProps) {
  const ultimo = adjuntos.at(-1)
  return <section data-investigation-files-card className="min-w-0 rounded-card border border-qms-border bg-qms-surface shadow-sm">
    <button type="button" onClick={onOpen} aria-label="Ver adjuntos del análisis" className="w-full min-w-0 cursor-pointer p-4 text-left">
      <span className="flex items-start gap-2">
        <Paperclip aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-qms-primary" />
        <span className="min-w-0 flex-1 text-sm font-semibold">Adjuntos del análisis</span>
        {!loading && !error && <span className="rounded-button bg-qms-primary-soft px-1.5 py-0.5 text-xs font-medium text-qms-primary">{adjuntos.length}</span>}
      </span>
      <span className="mt-3 block min-w-0 truncate text-xs text-qms-muted">
        {loading ? 'Cargando archivos…' : error ? 'No se pudieron cargar los archivos.' : ultimo ? ultimo.nombre : 'Sin archivos todavía'}
      </span>
      <span className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-qms-primary">
        Ver adjuntos <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </span>
    </button>
  </section>
}

interface PanelProps {
  open: boolean
  folio: string
  onClose: () => void
  adjuntos: QuejaAdjunto[]
  loading: boolean
  error: boolean
  onRetry: () => void
  canUpload: boolean
  uploadDisabled?: boolean
  uploading: boolean
  canDelete: (adjunto: QuejaAdjunto) => boolean
  onFiles: OnFiles
  onPreview: (adjunto: QuejaAdjunto) => void
  onDownload: (adjunto: QuejaAdjunto) => void
  onDelete: (adjunto: QuejaAdjunto) => void
}

export default function QuejaAdjuntosInvestigacion(props: PanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <Modal open={props.open} onClose={props.onClose} title={`Adjuntos del análisis · ${props.folio}`} size="lg" fixedHeight headerLeading={<Paperclip aria-hidden="true" className="size-4 text-qms-muted" />}
    footer={<div className="space-y-3">
      {props.canUpload && <div data-investigation-files-drop {...dropHandlers(!props.uploadDisabled && !props.uploading, props.onFiles)}
        className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-qms-border bg-qms-hover-bg p-3 data-[dragging=true]:border-qms-primary data-[dragging=true]:bg-qms-primary-soft">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-button bg-qms-primary-soft text-qms-primary"><Upload className="size-5" /></span>
          <div className="min-w-0"><p className="text-sm font-semibold">Subir nuevo archivo</p><p className="text-xs text-qms-muted">También podés arrastrarlo aquí.</p></div>
        </div>
        <Button size="sm" aria-label="Agregar archivos" onClick={() => inputRef.current?.click()} loading={props.uploading} loadingLabel="Subiendo archivos…" disabled={props.uploadDisabled || props.uploading}>
          Examinar
        </Button>
        <input ref={inputRef} aria-label="Seleccionar adjuntos del análisis" type="file" multiple hidden
          disabled={!props.canUpload || props.uploadDisabled || props.uploading}
          onChange={event => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (props.canUpload && files.length) props.onFiles(files)
          }}
        />
      </div>}
      <div className="flex justify-end"><Button variant="secondary" onClick={props.onClose}>Cerrar</Button></div>
    </div>}>
    <div data-attachment-list-scroll role="region" aria-label="Lista de adjuntos del análisis" tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-qms-muted uppercase">Evidencias</h3>
        {!props.loading && !props.error && <span className="rounded-button bg-qms-primary-soft px-2 py-0.5 text-xs font-medium text-qms-primary">{props.adjuntos.length}</span>}
      </div>
      {props.loading ? <LoadingSkeleton variant="list" label="Cargando adjuntos del análisis…" framed={false} />
        : props.error ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-qms-muted">No se pudieron cargar los archivos.<Button size="sm" variant="ghost" onClick={props.onRetry}>Reintentar</Button></div>
        : props.adjuntos.length ? <ListaAdjuntos adjuntos={props.adjuntos} layout="modal" onPreview={props.onPreview} onDownload={props.onDownload} puedeEliminar={props.canDelete} onEliminar={props.onDelete} />
        : <div className="flex flex-col items-center gap-2 py-5 text-center text-qms-muted"><FileText aria-hidden="true" className="size-6" /><p className="text-sm">Sin adjuntos de investigación todavía.</p></div>}
    </div>
  </Modal>
}
