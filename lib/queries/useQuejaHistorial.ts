'use client'

import { useEffect } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/services/apiClient'
import { queryKeys } from './queryKeys'

export interface QuejaMovimiento {
  id: string
  fecha: string
  usuario: string | null
  accion: string
}

function opcionesHistorial(quejaId: string) {
  return queryOptions({
    queryKey: [...queryKeys.quejas, 'historial', quejaId],
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }): Promise<QuejaMovimiento[]> => {
      const response = await apiFetch(`/api/quejas/historial?quejaId=${encodeURIComponent(quejaId)}`, { signal })
      if (!response.ok) throw new Error('No se pudo cargar el historial.')
      const { movimientos } = await response.json()
      return movimientos
    },
  })
}

export function useQuejaHistorial(quejaId: string, { abierto, visible }: { abierto: boolean; visible: boolean }) {
  const queryClient = useQueryClient()
  const historial = useQuery({ ...opcionesHistorial(quejaId), enabled: abierto && visible && !!quejaId })
  useEffect(() => {
    // Abrir el diálogo prepara la petición que comparte la pestaña Historial.
    if (abierto && quejaId) void queryClient.prefetchQuery(opcionesHistorial(quejaId))
  }, [abierto, quejaId, queryClient])
  return historial
}
