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
    canUpload && Array.from(event.dataTransfer.types).includes('Files')
  return {
    onDragOver(event: DragEvent<HTMLElement>) {
      if (!isFileDrag(event)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      event.currentTarget.dataset.dragging = 'true'
    },
    onDragLeave(event: DragEvent<HTMLElement>) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        delete event.currentTarget.dataset.dragging
      }
    },
    onDrop(event: DragEvent<HTMLElement>) {
      delete event.currentTarget.dataset.dragging
      if (!canUpload || !event.dataTransfer.files.length) return
      event.preventDefault()
      event.stopPropagation()
      onFiles(Array.from(event.dataTransfer.files))
    },
  }
}

interface CardProps {
  adjuntos: QuejaAdjunto[]
  loading: boolean
  error: boolean
  canUpload: boolean
  uploading: boolean
  onOpen: () => void
  onFiles: OnFiles
}

export function QuejaAdjuntosCard({ adjuntos, loading, error, canUpload, uploading, onOpen, onFiles }: CardProps) {
  const ultimo = adjuntos.at(-1)
  return <section data-investigation-files-card {...dropHandlers(canUpload, onFiles)}
    className="min-w-0 rounded-card border border-qms-border bg-qms-surface shadow-sm transition-colors data-[dragging=true]:border-qms-primary data-[dragging=true]:bg-qms-primary-soft">
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
      {canUpload && <span className="mt-2 block text-xs text-qms-muted">{uploading ? 'Subiendo archivos…' : 'También podés arrastrar archivos aquí'}</span>}
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
  uploading: boolean
  canDelete: (adjunto: QuejaAdjunto) => boolean
  onFiles: OnFiles
  onPreview: (adjunto: QuejaAdjunto) => void
  onDownload: (adjunto: QuejaAdjunto) => void
  onDelete: (adjunto: QuejaAdjunto) => void
}

export default function QuejaAdjuntosInvestigacion(props: PanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <Modal open={props.open} onClose={props.onClose} title={`Adjuntos del análisis · ${props.folio}`} size="lg"
    footer={<div className="flex justify-end"><Button variant="ghost" onClick={props.onClose}>Cerrar</Button></div>}>
    <div className="space-y-4">
      <div data-investigation-files-drop {...dropHandlers(props.canUpload && !props.uploading, props.onFiles)}
        className="rounded-card border border-dashed border-qms-border bg-qms-surface p-4 text-center data-[dragging=true]:border-qms-primary data-[dragging=true]:bg-qms-primary-soft">
        <Upload aria-hidden="true" className="mx-auto size-6 text-qms-primary" />
        <p className="mt-2 text-sm font-medium">Archivos de investigación</p>
        <p className="mt-1 text-xs text-qms-muted">{props.canUpload ? 'Arrastrá archivos aquí o seleccioná los que querés adjuntar.' : 'Consultá las evidencias registradas en este expediente.'}</p>
        {props.canUpload && <Button size="sm" className="mt-3" onClick={() => inputRef.current?.click()} loading={props.uploading} loadingLabel="Subiendo archivos…" disabled={props.uploading}>
          <Paperclip aria-hidden="true" className="size-4" />Agregar archivos
        </Button>}
        <input ref={inputRef} aria-label="Seleccionar adjuntos del análisis" type="file" multiple hidden
          disabled={!props.canUpload || props.uploading}
          onCancel={event => event.stopPropagation()}
          onChange={event => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (props.canUpload && files.length) props.onFiles(files)
          }}
        />
      </div>
      {props.loading ? <LoadingSkeleton variant="list" label="Cargando adjuntos del análisis…" framed={false} />
        : props.error ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-qms-muted">No se pudieron cargar los archivos.<Button size="sm" variant="ghost" onClick={props.onRetry}>Reintentar</Button></div>
        : props.adjuntos.length ? <ListaAdjuntos adjuntos={props.adjuntos} layout="cards" onPreview={props.onPreview} onDownload={props.onDownload} puedeEliminar={props.canDelete} onEliminar={props.onDelete} />
        : <div className="flex flex-col items-center gap-2 py-5 text-center text-qms-muted"><FileText aria-hidden="true" className="size-6" /><p className="text-sm">Sin adjuntos de investigación todavía.</p></div>}
    </div>
  </Modal>
}
