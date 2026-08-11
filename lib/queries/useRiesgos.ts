'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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

export async function fetchRiesgos(): Promise<Riesgo[]> {
  const { data, error } = await supabase
    .from('riesgos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Riesgo[]) ?? []
}

export function useRiesgos() {
  return useQuery({ queryKey: riesgosKey, queryFn: fetchRiesgos })
}
