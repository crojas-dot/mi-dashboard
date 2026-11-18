'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Queja } from '@/lib/types'
import { fetchQuejaById } from '@/lib/queries/useQuejas'
import { showError } from '@/lib/services/errorToast'

/** Resolución por ID independiente de la paginación, filtros y orden de la bandeja. */
export default function AgendaQuejaOpener({ onOpen, responsableId }: {
  onOpen: (queja: Queja) => void
  /** null significa que el usuario de Mis Quejas aún no está disponible. */
  responsableId?: string | null
}) {
  const params = useSearchParams()
  const id = params.get('open')
  const onOpenRef = useRef(onOpen)
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])
  useEffect(() => {
    if (!id || responsableId === null) return
    const controller = new AbortController()
    fetchQuejaById(id, responsableId, controller.signal).then(queja => {
      if (controller.signal.aborted) return
      if (queja) onOpenRef.current(queja)
      else showError(null, 'No se pudo abrir el expediente desde Agenda. Verificá que tengas acceso al registro.')
    }).catch(() => {
      if (!controller.signal.aborted) showError(null, 'No se pudo cargar el expediente seleccionado desde Agenda.')
    })
    return () => controller.abort()
  }, [id, responsableId])
  return null
}
