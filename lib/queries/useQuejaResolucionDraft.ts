'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queries/queryKeys'
import type { RichTextFormat } from '@/lib/utils/richText'

export interface QuejaResolucionDraft {
  queja_id: string
  version: number
  source_revision: number
  contenido: string
  formato: RichTextFormat
  actualizado_por: string
  updated_at: string
}

export const quejaResolucionDraftKey = (id: string) => [...queryKeys.quejas, 'resolucion-borrador', id] as const

export async function fetchQuejaResolucionDraft(id: string, signal?: AbortSignal): Promise<QuejaResolucionDraft | null> {
  const query = supabase.from('queja_resolution_drafts')
    .select('queja_id,version,source_revision,contenido,formato,actualizado_por,updated_at').eq('queja_id', id)
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle()
  if (error) throw error
  return data as QuejaResolucionDraft | null
}

export function useQuejaResolucionDraft(id: string, enabled: boolean) {
  return useQuery({ queryKey: quejaResolucionDraftKey(id), queryFn: ({ signal }) => fetchQuejaResolucionDraft(id, signal),
    enabled: !!id && enabled, staleTime: 0, retry: false })
}
