'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queries/queryKeys'
import type { QuejaMailSnapshot } from '@/supabase/functions/quejas-mail-queue/message'
import { apiFetch } from '@/lib/services/apiClient'

export interface QuejaPlazoRun {
  id: string; stage_id: string; started_at: string; expires_at: string | null
  ended_at: string | null; end_event: string | null; snapshot: unknown
}
export interface QuejaCorreoEstado {
  // Leer un evento histórico retirado no lo vuelve a habilitar en el emisor.
  id: string; tipo: QuejaMailSnapshot['tipo'] | 'investigacion'; status: string; sent_at: string | null
  safe_error?: string | null
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
  const query = supabase.from('queja_mail_outbox').select('id,tipo,status,sent_at,safe_error').eq('queja_id', id)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data ?? []) as QuejaCorreoEstado[]
}
export function useQuejaCorreos(id: string, enabled: boolean, requeuedId?: string) {
  return useQuery({ queryKey: [...queryKeys.quejas, 'correos', id], queryFn: ({ signal }) => fetchQuejaCorreos(id, signal), enabled: enabled && !!id, staleTime: 30_000,
    // El ACK del emisor no modifica quejas ni dispara su Realtime. Actualizar solo
    // mientras el envío final siga pendiente y esta vista esté activa/visible.
    refetchInterval: query => query.state.data?.some(message => (message.tipo === 'final' || message.id === requeuedId && !!requeuedId)
      && ['pending', 'leased', 'retry'].includes(message.status)) ? 30_000 : false,
    refetchIntervalInBackground: false,
  })
}

export function useReintentarQuejaCorreo(id: string, authId?: string) {
  const client = useQueryClient()
  const queryKey = [...queryKeys.quejas, 'correos', id]
  return useMutation({
    mutationFn: async (eventId: string) => {
      const params = new URLSearchParams({ quejaId: id, eventId })
      const response = await apiFetch(`/api/quejas/correos/reintentar?${params}`, { method: 'POST' }, authId)
        .catch(() => { throw new Error('No se pudo conectar con la cola de correo. Actualizá el estado antes de reintentar.') })
      const body = await response.json().catch(() => null)
      if (!response.ok || body?.queued !== true) throw new Error(body?.error || 'No se pudo confirmar el reintento de envío.')
    },
    onSettled: () => client.invalidateQueries({ queryKey, exact: true }),
  })
}
