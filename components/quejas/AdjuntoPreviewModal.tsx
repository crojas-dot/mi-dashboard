'use client'

import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, FileQuestion, Loader2, X } from 'lucide-react'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import { supabase } from '@/lib/supabase'
import { descargarAdjuntoQueja } from '@/lib/services/quejaWorkflowService'
import { showError } from '@/lib/services/errorToast'

interface Props {
  adjunto: QuejaAdjunto | null
  onClose: () => void
}

function esDrive(storagePath: string): boolean {
  return !storagePath.includes('/')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (adjunto) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [adjunto, onClose])

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-white" style={{ backgroundColor: '#212529' }}>
          <FileText className="h-4 w-4 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 select-text truncate text-sm font-semibold">{adjunto.nombre}</span>
          <span className="hidden whitespace-nowrap text-xs opacity-60 sm:inline">{formatBytes(adjunto.tamano)}</span>
          <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
            {drive ? 'Google Drive' : 'Interno'}
          </span>
          <button
            type="button"
            onClick={handleDescargar}
            disabled={descargando}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/40 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
            title="Descargar"
          >
            {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Descargar
          </button>
          {drive && (
            <a
              href={`https://drive.google.com/file/d/${adjunto.storage_path}/view`}
              target="_blank"
              rel="noreferrer"
              className="hidden shrink-0 rounded-lg border border-white/40 p-1.5 transition-colors hover:bg-white/10 sm:block"
              title="Abrir en Google Drive"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-lg p-1.5 opacity-60 transition-colors hover:bg-white/10 hover:opacity-100"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto" style={{ backgroundColor: '#f8f9fa' }}>
          {drive ? (
            <iframe
              src={`https://drive.google.com/file/d/${adjunto.storage_path}/preview`}
              title={adjunto.nombre}
              className="h-[80vh] w-full rounded-b-xl border-0"
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
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          )}
        </div>
      </div>
    </div>
  )
}
