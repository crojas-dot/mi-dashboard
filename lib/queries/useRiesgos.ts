'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchPagina, paginaKey, type Pagina } from './pagination'
import { queryKeys } from './queryKeys'

export interface Riesgo {
  id: string
  folio?: string
  descripcion?: string
  probabilidad: number
  impacto: number
  nivel?: string
  accion_mitigacion?: string
  responsable_id?: string
  estado?: string
}

export const riesgosKey = queryKeys.riesgos

export async function fetchRiesgos(page = 0, estado = ''): Promise<Pagina<Riesgo>> {
  return fetchPagina<Riesgo>('riesgos', 'fecha_identificacion', page, estado)
}

export function useRiesgos(page = 0, estado = '') {
  return useQuery({ queryKey: paginaKey(riesgosKey, page, estado), queryFn: () => fetchRiesgos(page, estado) })
}

export function useMatrizRiesgos() {
  return useQuery({
    queryKey: [...riesgosKey, 'matriz'],
    queryFn: async () => Promise.all(
      [1, 2, 3].flatMap((p) => [1, 2, 3].map(async (i) => {
        const { count, error } = await supabase.from('riesgos').select('id', { count: 'exact', head: true })
          .eq('probabilidad', p).eq('impacto', i)
        if (error) throw error
        return { p, i, count: count ?? 0 }
      })),
    ),
  })
}
