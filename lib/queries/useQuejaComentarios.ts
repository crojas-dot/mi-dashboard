'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface QuejaComentario {
  id: string
  queja_id: string
  usuario_id?: string | null
  comentario: string
  tipo: 'interno' | 'cliente'
  visible_cliente: boolean
  fecha: string
}

export function comentariosKey(quejaId: string) {
  return [...queryKeys.quejas, 'comentarios', quejaId] as const
}

export async function fetchQuejaComentarios(quejaId: string): Promise<QuejaComentario[]> {
  if (!quejaId) return []
  const { data, error } = await supabase
    .from('quejas_comentarios')
    .select('*')
    .eq('queja_id', quejaId)
    .order('fecha', { ascending: true })
  if (error) throw error
  return (data as QuejaComentario[]) ?? []
}

export function useQuejaComentarios(quejaId: string) {
  return useQuery({
    queryKey: comentariosKey(quejaId),
    queryFn: () => fetchQuejaComentarios(quejaId),
    enabled: !!quejaId,
  })
}

export function useCrearQuejaComentario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      quejaId,
      comentario,
      tipo,
      visibleCliente,
    }: {
      quejaId: string
      comentario: string
      tipo: 'interno' | 'cliente'
      visibleCliente: boolean
    }) => {
      const { data, error } = await supabase.rpc('agregar_comentario_queja', {
        p_queja_id: quejaId,
        p_comentario: comentario.trim(),
        p_tipo: tipo,
        p_visible_cliente: visibleCliente,
      })
      if (error) throw error
      return data as QuejaComentario
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: comentariosKey(vars.quejaId) })
    },
  })
}
