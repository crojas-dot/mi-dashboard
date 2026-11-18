'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries/queryKeys'
import { fetchQuejaPorId } from '@/lib/queries/useQuejas'

export function useQuejaAsignada(id: string, responsableId: string) {
  return useQuery({
    queryKey: [...queryKeys.quejas, 'asignada', responsableId, id],
    queryFn: ({ signal }) => fetchQuejaPorId(id, signal, responsableId),
    enabled: !!id && !!responsableId,
    staleTime: 0,
  })
}
