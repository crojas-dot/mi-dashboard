'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface SACP {
  id: string
  folio?: string
  tipo: string
  descripcion: string
  estado: string
  prioridad?: string
  fecha_limite?: string
  responsable_id?: string
  seguimiento_porcentaje?: number
  eficacia?: string
  notas?: string
  fecha_apertura?: string
}

export const accionesKey = queryKeys.acciones

export async function fetchAcciones(): Promise<SACP[]> {
  const { data, error } = await supabase
    .from('acciones')
    .select('*')
    .order('fecha_apertura', { ascending: false })
  if (error) throw error
  return (data as SACP[]) ?? []
}

export function useSACP() {
  return useQuery({ queryKey: accionesKey, queryFn: fetchAcciones })
}
