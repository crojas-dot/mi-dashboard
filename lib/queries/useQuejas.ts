'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Queja } from '@/lib/types'
import { queryKeys } from './queryKeys'

export interface QuejasParams {
  page?: number
  pageSize?: number
  search?: string
  estado?: string
  prioridad?: string
  responsableId?: string
}

function normalizeQuejasParams(params: QuejasParams = {}): Required<QuejasParams> {
  return {
    page: params.page ?? 0,
    pageSize: params.pageSize ?? 25,
    search: params.search ?? '',
    estado: params.estado ?? '',
    prioridad: params.prioridad ?? '',
    responsableId: params.responsableId ?? '',
  }
}

export function quejasKey(params: QuejasParams = {}) {
  return [...queryKeys.quejas, normalizeQuejasParams(params)] as const
}

export interface QuejasResult {
  data: Queja[]
  count: number
}

export async function fetchQuejas(params: QuejasParams = {}): Promise<QuejasResult> {
  const { page, pageSize, search, estado, prioridad, responsableId } = normalizeQuejasParams(params)
  let query = supabase.from('quejas').select('*', { count: 'exact' })
  if (search) query = query.or(`folio.ilike.%${search}%,cliente_nombre.ilike.%${search}%`)
  if (estado) query = query.eq('estado', estado)
  if (prioridad) query = query.eq('prioridad', prioridad)
  if (responsableId) query = query.eq('responsable_id', responsableId)
  const { data, error, count } = await query
    .order('fecha', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)
  if (error) throw error
  return { data: (data as Queja[]) ?? [], count: count ?? 0 }
}

export function useQuejas(params: QuejasParams = {}) {
  return useQuery({
    queryKey: quejasKey(params),
    queryFn: () => fetchQuejas(params),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}

export interface QuejaAdjunto {
  id: string
  queja_id: string
  nombre: string
  storage_path: string
  tamano: number
  tipo_mime: string
  usuario_id?: string | null
  created_at: string
}

export function quejaAdjuntosKey(quejaId: string) {
  return [...queryKeys.quejas, 'adjuntos', quejaId] as const
}

export async function fetchQuejaAdjuntos(quejaId: string): Promise<QuejaAdjunto[]> {
  if (!quejaId) return []
  const { data, error } = await supabase
    .from('queja_adjuntos')
    .select('*')
    .eq('queja_id', quejaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as QuejaAdjunto[]) ?? []
}

export function useQuejaAdjuntos(quejaId: string) {
  return useQuery({
    queryKey: quejaAdjuntosKey(quejaId),
    queryFn: () => fetchQuejaAdjuntos(quejaId),
    enabled: !!quejaId,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  })
}

export interface SLAConfig {
  id: string
  proceso: string
  prioridad: string
  dias_alerta: number
  dias_vencimiento: number
}

export const slaConfigKey = queryKeys.slaConfig

export async function fetchSLAConfig(proceso?: string): Promise<SLAConfig[]> {
  let query = supabase.from('sla_config').select('*')
  if (proceso) query = query.eq('proceso', proceso)
  const { data, error } = await query
  if (error) throw error
  return (data as SLAConfig[]) ?? []
}

export function useSLAConfig(proceso?: string) {
  return useQuery({ queryKey: slaConfigKey, queryFn: () => fetchSLAConfig(proceso) })
}

export interface QuejasEstadisticas {
  total: number
  mesActual: number
  resueltasATiempo: number
  resueltasTotal: number
  pctATiempo: number
  procedentes: number
  totalConDecision: number
  pctProcedencia: number
}

export const quejasEstadisticasKey = [...queryKeys.quejas, 'estadisticas'] as const

export async function fetchQuejasEstadisticas(): Promise<QuejasEstadisticas> {
  const { data, error } = await supabase.rpc('obtener_estadisticas_quejas')
  if (error) throw error
  const r = data as Record<string, number>
  return {
    total: r.total ?? 0,
    mesActual: r.mes_actual ?? 0,
    resueltasATiempo: r.resueltas_a_tiempo ?? 0,
    resueltasTotal: r.resueltas_total ?? 0,
    pctATiempo: r.pct_a_tiempo ?? 0,
    procedentes: r.procedentes ?? 0,
    totalConDecision: r.total_con_decision ?? 0,
    pctProcedencia: r.pct_procedencia ?? 0,
  }
}

export function useQuejasEstadisticas() {
  return useQuery({
    queryKey: quejasEstadisticasKey,
    queryFn: fetchQuejasEstadisticas,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
