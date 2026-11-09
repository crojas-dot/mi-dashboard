'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/services/apiClient'
import { queryKeys } from '@/lib/queries/queryKeys'

export async function fetchPublicacionQuejasDisponible(signal?: AbortSignal): Promise<boolean> {
  const response = await apiFetch('/api/quejas/seguimiento', { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudo comprobar la publicación de la respuesta. Reintentá antes de guardar.')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || typeof (data as Record<string, unknown>).enabled !== 'boolean') throw new Error('No se pudo comprobar la publicación de la respuesta. Reintentá antes de guardar.')
  return (data as { enabled: boolean }).enabled
}

export function usePublicacionQuejasDisponible(enabled: boolean) {
  // QueryProvider separa identidad/rol/vista. El flag no contiene claves ni accesos de expedientes.
  return useQuery({ queryKey: [...queryKeys.quejas, 'publicacion-disponible'],
    queryFn: ({ signal }) => fetchPublicacionQuejasDisponible(signal), enabled, staleTime: 30_000 })
}
