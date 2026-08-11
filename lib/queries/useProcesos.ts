'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface Proceso {
  id: string
  nombre_proceso?: string
  tipo?: string
  objetivo?: string
  responsable_id?: string
  estado: string
  documentos_vinculados?: string
  kpis?: string
}

export const procesosKey = queryKeys.procesos

export async function fetchProcesos(): Promise<Proceso[]> {
  const { data, error } = await supabase.from('procesos').select('*')
  if (error) throw error
  return (data as Proceso[]) ?? []
}

export function useProcesos() {
  return useQuery({ queryKey: procesosKey, queryFn: fetchProcesos })
}
