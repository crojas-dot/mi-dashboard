'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { quejaAdjuntosKey, type QuejaAdjunto } from '@/lib/queries/useQuejas'
import { descargarAdjuntoQueja, eliminarAdjuntoQueja, subirAdjuntoQueja } from '@/lib/services/quejaWorkflowService'
import { showError, showSuccess } from '@/lib/services/errorToast'
import type { EntityRequestScope } from '@/hooks/useEntityRequestGuard'

// Ambos paneles comparten el contrato de archivos; sus permisos y controles siguen en la vista.
export function useQuejaAttachmentActions(quejaId: string | null, scope: EntityRequestScope) {
  const queryClient = useQueryClient()
  const [previewAdjunto, setPreviewAdjunto] = useState<QuejaAdjunto | null>(null)
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false)
  const [eliminandoAdjunto, setEliminandoAdjunto] = useState<string | null>(null)
  const [confirmarEliminacion, setConfirmarEliminacion] = useState<string | null>(null)
  const [previousId, setPreviousId] = useState(quejaId)
  if (previousId !== quejaId) {
    setPreviousId(quejaId)
    setPreviewAdjunto(null)
    setSubiendoAdjunto(false)
    setEliminandoAdjunto(null)
    setConfirmarEliminacion(null)
  }

  const handleSubirAdjunto = async (file: File) => {
    if (!quejaId) return
    const operation = scope.start('attachment-upload')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setSubiendoAdjunto(true)
    try {
      await subirAdjuntoQueja(quejaId, file)
      // La escritura pertenece al expediente capturado, aunque la vista ya esté en otro.
      if (isContextCurrent()) void queryClient.invalidateQueries({ queryKey: quejaAdjuntosKey(quejaId) })
      if (operation.isCurrent()) showSuccess('Adjunto subido')
    } catch (error) {
      if (operation.isCurrent()) showError(error, 'No se pudo subir el adjunto')
    } finally {
      if (operation.isCurrent()) setSubiendoAdjunto(false)
      operation.finish()
    }
  }

  const handleEliminarAdjunto = async (adjuntoId: string) => {
    if (!quejaId) return
    const operation = scope.start('attachment-delete')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setEliminandoAdjunto(adjuntoId)
    try {
      await eliminarAdjuntoQueja(adjuntoId)
      if (isContextCurrent()) void queryClient.invalidateQueries({ queryKey: quejaAdjuntosKey(quejaId) })
      if (operation.isCurrent()) {
        showSuccess('Adjunto eliminado')
        setConfirmarEliminacion(current => current === adjuntoId ? null : current)
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, 'No se pudo eliminar el adjunto')
    } finally {
      if (operation.isCurrent()) setEliminandoAdjunto(null)
      operation.finish()
    }
  }

  const handleDescargarAdjunto = async (adjunto: QuejaAdjunto) => {
    const operation = scope.start('attachment-download:' + adjunto.id)
    if (!operation) return
    try {
      await descargarAdjuntoQueja(adjunto)
    } catch (error) {
      if (operation.isCurrent()) showError(error, 'No se pudo descargar el adjunto')
    } finally {
      operation.finish()
    }
  }

  return {
    previewAdjunto, setPreviewAdjunto, subiendoAdjunto, eliminandoAdjunto,
    confirmarEliminacion, setConfirmarEliminacion,
    handleSubirAdjunto, handleEliminarAdjunto, handleDescargarAdjunto,
  }
}
