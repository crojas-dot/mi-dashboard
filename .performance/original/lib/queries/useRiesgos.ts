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
    queryFn: async () => {
      const { data, error } = await supabase.from('riesgos').select('probabilidad, impacto')
      if (error) throw error
      const conteo = new Map<string, number>()
      for (const r of (data ?? []) as { probabilidad: number; impacto: number }[]) {
        const clave = `${r.probabilidad}:${r.impacto}`
        conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
      }
      return [1, 2, 3].flatMap((p) =>
        [1, 2, 3].map((i) => ({ p, i, count: conteo.get(`${p}:${i}`) ?? 0 })),
      )
    },
  })
}
