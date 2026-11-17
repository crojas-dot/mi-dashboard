'use client'

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { Download, ExternalLink, FileText, FileQuestion, X } from 'lucide-react'
import OperationLoading from '@/components/ui/OperationLoading'
import Spinner from '@/components/ui/Spinner'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import { supabase } from '@/lib/supabase'
import { fetchDriveBlob, fetchDrivePreviewUrl } from '@/lib/services/driveClient'
import { useAuthStore } from '@/lib/store/auth-store'
import { descargarAdjuntoQueja } from '@/lib/services/quejaWorkflowService'
import { showError } from '@/lib/services/errorToast'
import { formatBytes } from '@/lib/utils/format'
import { tipoVistaLocal } from '@/lib/utils/adjuntoPreview'

interface Props { adjunto: QuejaAdjunto | null; onClose: () => void }
type FilePreview = { kind: 'image' | 'audio' | 'video' | 'pdf' | 'drive'; url: string }
  | { kind: 'text'; text: string; truncated: boolean }
  | { kind: 'unsupported' | 'error' }
const esDrive = (path: string) => !path.includes('/')
const MAX_TEXT_PREVIEW = 256 * 1024
const READY_CLASS = 'transition-opacity duration-150 motion-reduce:transition-none'

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
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [ready, setReady] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const storagePath = adjunto.storage_path
  const drive = esDrive(storagePath)
  const waiting = !preview || ('url' in preview && !ready)

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
    const controller = new AbortController()
    const actor = useAuthStore.getState().user
    let alive = true
    let objectUrl: string | null = null
    async function load() {
      try {
        if (!actor) throw new Error('Sesión no disponible')
        const active = () => alive && !controller.signal.aborted
        const local = tipoVistaLocal(adjunto.tipo_mime, adjunto.nombre)
        if (drive && !local) {
          const url = await fetchDrivePreviewUrl(storagePath, controller.signal)
          if (active()) setPreview({ kind: 'drive', url })
          return
        }
        if (!local) {
          setPreview({ kind: 'unsupported' })
          return
        }
        const source = drive ? await fetchDriveBlob(storagePath, controller.signal) : await (async () => {
          const { data, error } = await supabase.storage.from('quejas-adjuntos').download(storagePath, {}, { signal: controller.signal })
          if (error || !data) throw error ?? new Error('No se pudo leer el adjunto')
          return data
        })()
        if (!active()) return
        if (local.kind === 'text') {
          const text = await source.slice(0, MAX_TEXT_PREVIEW).text()
          if (active()) setPreview({ kind: 'text', text, truncated: source.size > MAX_TEXT_PREVIEW })
          return
        }
        // Nunca cargar HTML o SVG disfrazado dentro de un iframe de mismo origen.
        if (local.kind === 'pdf' && !(await source.slice(0, 16).text()).startsWith('%PDF-')) throw new Error('PDF no disponible')
        if (!active()) return
        const blob = source.slice(0, source.size, local.mime)
        objectUrl = URL.createObjectURL(blob)
        setPreview({ kind: local.kind, url: objectUrl })
      } catch {
        if (alive && !controller.signal.aborted) setPreview({ kind: 'error' })
      }
    }
    void load()
    // Al cambiar de cuenta o rol se retiran tanto la vista privada como sus bytes.
    const unsubscribe = useAuthStore.subscribe((session) => {
      if (session.user?.id !== actor?.id || session.user?.rol !== actor?.rol || session.signingOut) {
        controller.abort()
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        objectUrl = null
        setPreview({ kind: 'error' })
      }
    })
    return () => {
      alive = false
      controller.abort()
      unsubscribe()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [storagePath, drive, attempt, adjunto.tipo_mime, adjunto.nombre])

  useEffect(() => {
    if (!waiting) return
    // La vista caliente se revela al cargar. El indicador solo aparece si la
    // espera dura lo suficiente para que no sea un destello entre dos imágenes.
    const timer = window.setTimeout(() => setShowLoading(true), 180)
    return () => window.clearTimeout(timer)
  }, [waiting, attempt])

  useEffect(() => {
    if (preview?.kind !== 'drive' || ready) return
    const timer = window.setTimeout(() => setReady(true), 12_000)
    return () => window.clearTimeout(timer)
  }, [preview, ready])

  const markReady = () => setReady(true)
  const markError = () => setPreview({ kind: 'error' })
  const reveal = `${READY_CLASS} ${ready ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

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
      <span className="hidden rounded border border-qms-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-qms-muted sm:inline">{drive ? 'Google Drive' : 'Interno'}</span>
      {preview?.kind === 'drive' && <a href={preview.url} target="_blank" rel="noopener noreferrer" title="Abrir en Google Drive" aria-label="Abrir en Google Drive"
        className="ui-button ui-button-ghost ui-button-icon shrink-0"><ExternalLink className="size-4" aria-hidden="true" /></a>}
      <button type="button" onClick={handleDescargar} disabled={descargando} aria-busy={descargando}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-qms-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-qms-hover-bg disabled:opacity-50" title="Descargar">
        {descargando ? <Spinner size="sm" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />} Descargar
      </button>
      <button type="button" onClick={onClose} className="shrink-0 cursor-pointer rounded-lg p-1.5 text-qms-muted transition-colors hover:bg-qms-hover-bg hover:text-qms-dark" title="Cerrar" aria-label="Cerrar visor de documentos">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div aria-busy={waiting} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-qms-hover-bg">
      {preview && 'url' in preview && <div className={`flex min-h-0 flex-1 items-center justify-center overflow-auto p-2 sm:p-3 ${reveal}`}>
        {preview.kind === 'image' &&
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt={adjunto.nombre} className="max-h-full max-w-full rounded-lg object-contain" onLoad={markReady} onError={markError} />}
        {preview.kind === 'video' && <video controls src={preview.url} className="max-h-full max-w-full rounded-lg bg-black" onLoadedData={markReady} onError={markError} />}
        {preview.kind === 'audio' && <audio controls src={preview.url} className="w-full" onLoadedMetadata={markReady} onError={markError} />}
        {preview.kind === 'pdf' && <iframe src={preview.url} title={adjunto.nombre} className="h-full w-full rounded-lg border-0" onLoad={markReady} />}
        {preview.kind === 'drive' && <iframe src={preview.url} title={`Vista de Google Drive: ${adjunto.nombre}`} referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups" className="h-full w-full rounded-lg border-0" onLoad={markReady} />}
      </div>}
      {preview?.kind === 'drive' && <p className="shrink-0 px-3 pb-2 text-center text-xs text-qms-muted">Si Drive pide acceso, abrí la vista en otra pestaña o descargá el archivo.</p>}
      {preview?.kind === 'text' && <div className="min-h-0 flex-1 overflow-auto p-4">
        <pre className="whitespace-pre-wrap wrap-anywhere text-sm text-qms-dark">{preview.text}</pre>
        {preview.truncated && <p className="mt-4 text-xs text-qms-muted">Descargá el archivo para leer el texto completo.</p>}
      </div>}
      {(preview?.kind === 'error' || preview?.kind === 'unsupported') && <div className="m-auto flex flex-col items-center gap-2 p-5 text-center" role="status">
          <FileQuestion className="h-12 w-12 text-qms-muted" aria-hidden="true" />
          <p className="text-sm text-qms-muted">{preview.kind === 'error' ? 'No se pudo preparar la vista previa.' : 'Descargá el archivo para abrir este formato.'}</p>
          {preview.kind === 'error' && <button type="button" className="ui-button ui-button-secondary" onClick={() => {
            setPreview(null); setReady(false); setShowLoading(false); setAttempt(value => value + 1)
          }}>Reintentar vista previa</button>}
        </div>}
      {waiting && showLoading && <div className="pointer-events-none absolute inset-0 grid place-items-center"><OperationLoading label="Preparando vista previa…" /></div>}
    </div>
  </dialog>
}
