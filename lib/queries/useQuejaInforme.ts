'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/services/apiClient'
import { queryKeys } from '@/lib/queries/queryKeys'
import type { QuejaInforme } from '@/lib/utils/quejaInforme'

export const quejaInformeKey = (id: string) => [...queryKeys.quejas, 'informe', id] as const

export async function fetchQuejaInforme(id: string, signal?: AbortSignal): Promise<QuejaInforme | null> {
  const response = await apiFetch('/api/quejas/informe?quejaId=' + encodeURIComponent(id), { signal })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'No se pudo consultar el informe.')
  return body.informe
}

export function useQuejaInforme(id: string) {
  return useQuery({ queryKey: quejaInformeKey(id), queryFn: ({ signal }) => fetchQuejaInforme(id, signal), enabled: !!id, staleTime: 0, retry: false })
}
