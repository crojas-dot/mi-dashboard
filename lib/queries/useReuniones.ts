'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface Reunion {
  id: string
  titulo: string
  fecha_programada?: string
  participantes?: string
  agenda?: string
  estado: string
  acta_drive_id?: string
}

export const reunionesKey = queryKeys.reuniones

export async function fetchReuniones(): Promise<Reunion[]> {
  const { data, error } = await supabase
    .from('reuniones')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Reunion[]) ?? []
}

export function useReuniones() {
  return useQuery({ queryKey: reunionesKey, queryFn: fetchReuniones })
}
