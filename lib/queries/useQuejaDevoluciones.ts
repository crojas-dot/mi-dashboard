'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DevolucionConSoportes {
  motivo: string
  fecha: string
  sourceRevision: number
  adjuntoIds: string[]
}

export const quejaDevolucionesKey = (id: string) => ['quejas', 'devoluciones-gc', id] as const

export async function fetchQuejaDevoluciones(id: string): Promise<DevolucionConSoportes[]> {
  if (!id) return []
  const { data, error } = await supabase.from('queja_gc_revisiones')
    .select('source_revision,motivo,created_at,queja_gc_revision_adjuntos(adjunto_id)')
    .eq('queja_id', id).eq('decision', 'returned').order('source_revision', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{
    source_revision: number
    motivo: string | null
    created_at: string
    queja_gc_revision_adjuntos: Array<{ adjunto_id: string }>
  }>
  return rows.map(row => ({
    motivo: row.motivo ?? '', fecha: row.created_at, sourceRevision: row.source_revision,
    adjuntoIds: (row.queja_gc_revision_adjuntos ?? []).map(item => item.adjunto_id),
  }))
}

export function useQuejaDevoluciones(id: string, enabled: boolean) {
  return useQuery({
    queryKey: quejaDevolucionesKey(id),
    queryFn: () => fetchQuejaDevoluciones(id),
    enabled: enabled && !!id,
    staleTime: 30_000,
  })
}
