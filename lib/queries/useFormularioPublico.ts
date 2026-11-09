'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries/queryKeys'
import { fetchFormularioPublico } from '@/lib/services/publicQuejasClient'

export function useFormularioPublico(token: string) {
  return useQuery({
    queryKey: [...queryKeys.publicFormulario, token],
    queryFn: ({ signal }) => fetchFormularioPublico(token, signal),
    enabled: !!token,
    staleTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })
}