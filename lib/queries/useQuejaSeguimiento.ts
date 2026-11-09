'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queries/queryKeys'
import type { QuejaMailSnapshot } from '@/supabase/functions/quejas-mail-queue/message'

export interface QuejaPlazoRun {
  id: string; stage_id: string; started_at: string; expires_at: string | null
  ended_at: string | null; end_event: string | null; snapshot: unknown
}
export interface QuejaCorreoEstado {
  // Leer un evento histórico retirado no lo vuelve a habilitar en el emisor.
  id: string; tipo: QuejaMailSnapshot['tipo'] | 'investigacion'; status: string; sent_at: string | null
}
export async function fetchQuejaPlazos(id: string, signal?: AbortSignal): Promise<QuejaPlazoRun[]> {
  if (!id) return []
  const query = supabase.from('qms_stage_runs').select('id,stage_id,started_at,expires_at,ended_at,end_event,snapshot')
    .eq('case_id', id).order('started_at', { ascending: false }).order('id').limit(20)
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data ?? []) as QuejaPlazoRun[]
}
export function useQuejaPlazos(id: string) {
  return useQuery({ queryKey: [...queryKeys.quejas, 'plazos', id], queryFn: ({ signal }) => fetchQuejaPlazos(id, signal), enabled: !!id, staleTime: 30_000 })
}
export async function fetchQuejaCorreos(id: string, signal?: AbortSignal): Promise<QuejaCorreoEstado[]> {
  if (!id) return []
  // SELECT limitado: RLS/column grants mantienen destinatario y claims fuera del cliente.
  const query = supabase.from('queja_mail_outbox').select('id,tipo,status,sent_at').eq('queja_id', id).order('created_at', { ascending: true })
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data ?? []) as QuejaCorreoEstado[]
}
export function useQuejaCorreos(id: string, enabled: boolean) {
  return useQuery({ queryKey: [...queryKeys.quejas, 'correos', id], queryFn: ({ signal }) => fetchQuejaCorreos(id, signal), enabled: enabled && !!id, staleTime: 30_000 })
}
