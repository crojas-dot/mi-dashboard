'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface QuejaActividad {
  id: string
  queja_id: string
  tipo: string
  descripcion: string
  usuario_id?: string | null
  created_at: string
}

export function quejaActividadKey(quejaId: string) {
  return [...queryKeys.quejasActividad, quejaId] as const
}

export async function fetchQuejaActividad(quejaId: string, signal?: AbortSignal): Promise<QuejaActividad[]> {
  const query = supabase
    .from('quejas_actividad')
    .select('*')
    .eq('queja_id', quejaId)
    .order('created_at', { ascending: true })
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data as QuejaActividad[]) ?? []
}

export function useQuejaActividad(quejaId: string) {
  return useQuery({
    queryKey: quejaActividadKey(quejaId),
    queryFn: ({ signal }) => fetchQuejaActividad(quejaId, signal),
    enabled: !!quejaId,
    staleTime: 30_000,
  })
}

export function useCrearQuejaActividad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { quejaId: string; descripcion: string; usuarioId?: string | null; isContextCurrent?: () => boolean }) => {
      const { error } = await supabase.from('quejas_actividad').insert([
        {
          queja_id: input.quejaId,
          tipo: 'nota',
          descripcion: input.descripcion.trim(),
          usuario_id: input.usuarioId ?? null,
        },
      ])
      if (error) throw error
    },
    onSuccess: (_data, input) => {
      if (input.isContextCurrent?.() === false) return
      queryClient.invalidateQueries({ queryKey: quejaActividadKey(input.quejaId) })
    },
  })
}
