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

interface Props {
  adjunto: QuejaAdjunto | null
  onClose: () => void
}

function esDrive(storagePath: string): boolean {
  return !storagePath.includes('/')
}

interface VistaLegacyProps {
  url: string
  mime: string
  nombre: string
}

function VistaLegacy({ url, mime, nombre }: VistaLegacyProps) {
  if (mime.startsWith('image/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={nombre} className="mx-auto max-h-[80vh] max-w-full rounded-lg" />
    )
  }
  if (mime.startsWith('video/')) {
    return <video controls src={url} className="max-h-[80vh] w-full rounded-lg bg-black" />
  }
  if (mime.startsWith('audio/')) {
    return <audio controls src={url} className="w-full" />
  }
  if (mime === 'application/pdf') {
    return <iframe src={url} title={nombre} className="h-[80vh] w-full rounded-b-lg border-0" />
  }
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <FileQuestion className="h-12 w-12 text-gray-300" />
      <p className="text-sm font-medium text-gray-700">{nombre}</p>
      <p className="text-xs text-gray-400">Sin vista previa para este formato ({mime}). Usa el botón Descargar.</p>
    </div>
  )
}

export default function AdjuntoPreviewModal({ adjunto, onClose }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropDown = useRef(false)
  const [legacyUrl, setLegacyUrl] = useState<string | null>(null)
  const [legacyError, setLegacyError] = useState(false)
  const [descargando, setDescargando] = useState(false)

  const adjuntoId = adjunto?.id ?? null
  const [prevAdjuntoId, setPrevAdjuntoId] = useState<string | null>(null)
  if (adjuntoId !== prevAdjuntoId) {
    setPrevAdjuntoId(adjuntoId)
    setLegacyUrl(null)
    setLegacyError(false)
  }

  const open = !!adjunto
  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // showModal coloca el visor en la misma capa superior que el formulario, por encima de este.
    dialog.showModal()
    return () => {
      dialog.close()
      if (document.activeElement === document.body && origin?.isConnected) origin.focus()
    }
  }, [open])

  useEffect(() => {
    if (!adjunto || esDrive(adjunto.storage_path)) return
    let alive = true
    supabase.storage
      .from('quejas-adjuntos')
      .createSignedUrl(adjunto.storage_path, 3600)
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data?.signedUrl) setLegacyError(true)
        else setLegacyUrl(data.signedUrl)
      })
      .catch(() => {
        if (alive) setLegacyError(true)
      })
    return () => { alive = false }
  }, [adjunto])

  if (!adjunto) return null

  const drive = esDrive(adjunto.storage_path)
  const outside = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return false
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }

  const handleDescargar = async () => {
    setDescargando(true)
    try {
      await descargarAdjuntoQueja(adjunto)
    } catch (error) {
      showError(error as Error, 'No se pudo descargar el archivo')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 m-auto max-h-[95dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-2xl backdrop:bg-black/60 open:flex"
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
      onMouseDown={event => { backdropDown.current = outside(event) }}
      onClick={event => {
        if (backdropDown.current && outside(event)) onClose()
        backdropDown.current = false
      }}
    >
        <div className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-white bg-qms-dark">
          <FileText className="h-4 w-4 shrink-0 opacity-70" />
          <span id={titleId} className="min-w-0 flex-1 select-text truncate text-sm font-semibold">{adjunto.nombre}</span>
          <span className="hidden whitespace-nowrap text-xs opacity-60 sm:inline">{formatBytes(adjunto.tamano)}</span>
          <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
            {drive ? 'Google Drive' : 'Interno'}
          </span>
          <button
            type="button"
            onClick={handleDescargar}
            disabled={descargando}
            aria-busy={descargando}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/40 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
            title="Descargar"
          >
            {descargando ? <Spinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
            Descargar
          </button>
          {drive && (
            <a
              href={`https://drive.google.com/file/d/${adjunto.storage_path}/view`}
              target="_blank"
              rel="noreferrer"
              className="hidden shrink-0 rounded-lg border border-white/40 p-1.5 transition-colors hover:bg-white/10 sm:block"
              title="Abrir en Google Drive"
              aria-label="Abrir en Google Drive"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-lg p-1.5 opacity-60 transition-colors hover:bg-white/10 hover:opacity-100"
            title="Cerrar"
            aria-label="Cerrar visor de documentos"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-qms-hover-bg">
          {drive ? (
            <iframe
              src={`https://drive.google.com/file/d/${adjunto.storage_path}/preview`}
              title={adjunto.nombre}
              className="h-[80dvh] w-full rounded-b-xl border-0"
              allow="autoplay"
            />
          ) : legacyUrl ? (
            <div className="w-full p-3">
              <VistaLegacy url={legacyUrl} mime={adjunto.tipo_mime} nombre={adjunto.nombre} />
            </div>
          ) : legacyError ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <FileQuestion className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-500">No se pudo generar la vista previa de este archivo.</p>
            </div>
          ) : (
            <OperationLoading label="Preparando vista previa…" />
          )}
        </div>
    </dialog>
  )
}
