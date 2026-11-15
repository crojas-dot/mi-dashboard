'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

/** Datos guardados en la transición Procede: NO son la justificación de evaluación. */
export interface QuejaInvestigationAssignment {
  queja_id: string
  responsable_id: string
  instrucciones: string
  oficio_adjunto_id: string | null
  asignado_por: string
  updated_at: string
}

export const quejaInvestigationAssignmentKey = (id: string) =>
  [...queryKeys.quejas, 'investigation-assignment', id] as const

export async function fetchQuejaInvestigationAssignment(id: string, signal?: AbortSignal) {
  const query = supabase.from('queja_investigation_assignments')
    .select('queja_id,responsable_id,instrucciones,oficio_adjunto_id,asignado_por,updated_at')
    .eq('queja_id', id)
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle()
  if (error) throw error
  return data as QuejaInvestigationAssignment | null
}

export function useQuejaInvestigationAssignment(id: string, enabled: boolean) {
  return useQuery({
    queryKey: quejaInvestigationAssignmentKey(id),
    queryFn: ({ signal }) => fetchQuejaInvestigationAssignment(id, signal),
    enabled: !!id && enabled,
    staleTime: 30_000,
    retry: false,
  })
}
