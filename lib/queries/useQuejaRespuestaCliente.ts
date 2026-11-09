'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queries/queryKeys'
import type { RichTextFormat } from '@/lib/utils/richText'

export interface RespuestaClienteDraft {
  queja_id: string
  version: number
  respuesta: string
  numero_oficio: string
  adjunto_id: string | null
  actualizado_por: string
  updated_at: string
}
export interface RespuestaClienteContext {
  borrador: RespuestaClienteDraft | null
  aprobacion: { propuesta: string; propuesta_formato: RichTextFormat; created_at: string; usuario_id: string } | null
  publicada: { respuesta: string; adjunto_id: string; publicado_at: string; publicado_por: string } | null
}
export const respuestaClienteKey = (id: string) => [...queryKeys.quejas, 'respuesta-cliente', id] as const

export async function fetchRespuestaCliente(id: string, signal?: AbortSignal): Promise<RespuestaClienteContext> {
  const requests = [
    supabase.from('queja_response_drafts').select('queja_id,version,respuesta,numero_oficio,adjunto_id,actualizado_por,updated_at').eq('queja_id', id),
    supabase.from('queja_gc_revisiones').select('propuesta,propuesta_formato,created_at,usuario_id').eq('queja_id', id).eq('decision', 'approved').order('source_revision', { ascending: false }).limit(1),
    supabase.from('queja_public_resolutions').select('respuesta,adjunto_id,publicado_at,publicado_por').eq('queja_id', id),
  ]
  const results = await Promise.all(requests.map(query => (signal ? query.abortSignal(signal) : query).maybeSingle()))
  for (const result of results) if (result.error) throw result.error
  return { borrador: results[0].data, aprobacion: results[1].data, publicada: results[2].data } as RespuestaClienteContext
}

export function useRespuestaCliente(id: string) {
  return useQuery({ queryKey: respuestaClienteKey(id), queryFn: ({ signal }) => fetchRespuestaCliente(id, signal),
    enabled: !!id, staleTime: 0, retry: false })
}
