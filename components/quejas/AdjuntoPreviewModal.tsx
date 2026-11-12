'use client'

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { Download, ExternalLink, FileText, FileQuestion, X } from 'lucide-react'
import OperationLoading from '@/components/ui/OperationLoading'
import Spinner from '@/components/ui/Spinner'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import { supabase } from '@/lib/supabase'
import { descargarAdjuntoQueja } from '@/lib/services/quejaWorkflowService'
import { showError } from '@/lib/services/errorToast'
import { formatBytes } from '@/lib/utils/format'

interface Props { adjunto: QuejaAdjunto | null; onClose: () => void }
interface LegacyPreview { url?: string; error?: boolean }
const esDrive = (path: string) => !path.includes('/')
function legacyMime(mime: string, nombre: string) {
  const normalized = mime.toLowerCase().split(';')[0].trim()
  if (normalized && normalized !== 'application/octet-stream') return normalized
  const extension = nombre.split('.').pop()?.toLowerCase() ?? ''
  return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' } as Record<string, string>)[extension] ?? normalized
}

function VistaLegacy({ url, mime, nombre }: { url: string; mime: string; nombre: string }) {
  if (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre} className="mx-auto max-h-full max-w-full rounded-lg object-contain" />
  }
  if (mime.startsWith('video/')) return <video controls src={url} className="max-h-full max-w-full rounded-lg bg-black" />
  if (mime.startsWith('audio/')) return <audio controls src={url} className="w-full" />
  if (mime === 'application/pdf') return <iframe src={url} title={nombre} className="h-full w-full rounded-lg border-0" />
  return <div className="flex flex-col items-center gap-3 p-10 text-center">
    <FileQuestion className="h-12 w-12 text-qms-muted" aria-hidden="true" />
    <p className="text-sm font-medium text-qms-dark">{nombre}</p>
    <p className="text-xs text-qms-muted">Sin vista previa para este formato. Usá el botón Descargar.</p>
  </div>
}

export default function AdjuntoPreviewModal({ adjunto, onClose }: Props) {
  // Cerrar o cambiar archivo desmonta su visita; las respuestas y errores anteriores
  // nunca se reutilizan al volver a abrir la misma evidencia.
  if (!adjunto) return null
  return <AdjuntoPreviewVisit key={adjunto.id + ':' + adjunto.storage_path} adjunto={adjunto} onClose={onClose} />
}

function AdjuntoPreviewVisit({ adjunto, onClose }: { adjunto: QuejaAdjunto; onClose: () => void }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropDown = useRef(false)
  const downloadPending = useRef(false)
  const [legacy, setLegacy] = useState<LegacyPreview | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const storagePath = adjunto.storage_path
  const drive = esDrive(storagePath)
  const driveUrl = 'https://drive.google.com/file/d/' + encodeURIComponent(storagePath)
  const mime = legacyMime(adjunto.tipo_mime ?? '', adjunto.nombre)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // La capa nativa conserva foco y Escape sobre el formulario que abrió el visor.
    if (!dialog.open) dialog.showModal()
    return () => {
      dialog.close()
      if (document.activeElement === document.body && origin?.isConnected) origin.focus()
    }
  }, [])

  useEffect(() => {
    if (drive) return
    let alive = true
    supabase.storage.from('quejas-adjuntos').createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (alive) setLegacy(error || !data?.signedUrl ? { error: true } : { url: data.signedUrl })
      })
      .catch(() => { if (alive) setLegacy({ error: true }) })
    return () => { alive = false }
  }, [storagePath, drive, attempt])

  const outside = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return false
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }
  const handleDescargar = async () => {
    if (downloadPending.current) return
    downloadPending.current = true
    setDescargando(true)
    try { await descargarAdjuntoQueja(adjunto) }
    catch (error) { showError(error as Error, 'No se pudo descargar el archivo') }
    finally { downloadPending.current = false; setDescargando(false) }
  }

  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true"
    className="fixed inset-0 m-auto h-[min(92dvh,56rem)] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-xl border-0 bg-qms-surface p-0 shadow-2xl backdrop:bg-black/60 open:flex"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onMouseDown={event => { backdropDown.current = outside(event) }}
    onClick={event => { if (backdropDown.current && outside(event)) onClose(); backdropDown.current = false }}>
    <div className="flex shrink-0 items-center gap-2 border-b border-qms-border bg-qms-surface px-4 py-2.5 text-qms-dark">
      <FileText className="h-4 w-4 shrink-0 text-qms-primary" aria-hidden="true" />
      <span id={titleId} className="min-w-0 flex-1 select-text truncate text-sm font-semibold">{adjunto.nombre}</span>
      <span className="hidden whitespace-nowrap text-xs text-qms-muted sm:inline">{formatBytes(adjunto.tamano)}</span>
      <span className="rounded border border-qms-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-qms-muted">{drive ? 'Google Drive' : 'Interno'}</span>
      <button type="button" onClick={handleDescargar} disabled={descargando} aria-busy={descargando}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-qms-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-qms-hover-bg disabled:opacity-50" title="Descargar">
        {descargando ? <Spinner size="sm" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />} Descargar
      </button>
      {drive && <a href={driveUrl + '/view'} target="_blank" rel="noreferrer"
        className="hidden shrink-0 rounded-lg border border-qms-border p-1.5 transition-colors hover:bg-qms-hover-bg sm:block" title="Abrir en Google Drive" aria-label="Abrir en Google Drive">
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>}
      <button type="button" onClick={onClose} className="shrink-0 cursor-pointer rounded-lg p-1.5 text-qms-muted transition-colors hover:bg-qms-hover-bg hover:text-qms-dark" title="Cerrar" aria-label="Cerrar visor de documentos">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-qms-hover-bg">
      {drive ? <iframe key={storagePath} src={driveUrl + '/preview'} title={adjunto.nombre} className="h-full w-full border-0 bg-qms-hover-bg" allow="autoplay" />
        : legacy?.url ? <div className="flex h-full min-h-0 w-full items-center justify-center overflow-auto p-3"><VistaLegacy url={legacy.url} mime={mime} nombre={adjunto.nombre} /></div>
        : legacy?.error ? <div className="flex flex-col items-center gap-2 p-10 text-center" role="alert">
          <FileQuestion className="h-12 w-12 text-qms-muted" aria-hidden="true" />
          <p className="text-sm text-qms-muted">No se pudo generar la vista previa de este archivo.</p>
          <button type="button" className="ui-button ui-button-secondary" onClick={() => { setLegacy(null); setAttempt(value => value + 1) }}>Reintentar vista previa</button>
        </div> : <OperationLoading label="Preparando vista previa…" />}
    </div>
  </dialog>
}
