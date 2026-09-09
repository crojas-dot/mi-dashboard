'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchPagina, paginaKey, type Pagina } from './pagination'
import { queryKeys } from './queryKeys'

export interface Auditoria {
  id: string
  folio?: string
  tipo: string
  objetivo?: string
  alcance?: string
  proceso_area?: string
  fecha_inicio?: string
  fecha_fin?: string
  estado: string
}

export interface Hallazgo {
  id: string
  auditoria_id: string
  descripcion: string
  tipo: string
  derivado_sacp_id?: string
}

export const auditoriasKey = queryKeys.auditorias

export async function fetchAuditorias(page = 0, estado = ''): Promise<Pagina<Auditoria>> {
  return fetchPagina<Auditoria>('auditorias', 'created_at', page, estado)
}

export function useAuditorias(page = 0, estado = '') {
  return useQuery({ queryKey: paginaKey(auditoriasKey, page, estado), queryFn: () => fetchAuditorias(page, estado) })
}

export function hallazgosKey(auditoriaId: string) {
  return [...queryKeys.auditorias, 'hallazgos', auditoriaId] as const
}

export async function fetchHallazgos(auditoriaId: string): Promise<Hallazgo[]> {
  const { data, error } = await supabase
    .from('hallazgos')
    .select('*')
    .eq('auditoria_id', auditoriaId)
  if (error) throw error
  return (data as Hallazgo[]) ?? []
}

export function useHallazgos(auditoriaId: string) {
  return useQuery({
    queryKey: hallazgosKey(auditoriaId),
    queryFn: () => fetchHallazgos(auditoriaId),
    enabled: !!auditoriaId,
  })
}
