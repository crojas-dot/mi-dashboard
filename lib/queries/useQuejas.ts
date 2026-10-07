'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Queja } from '@/lib/types'
import { queryKeys } from './queryKeys'
import { containsPattern } from '@/lib/utils/postgrest'

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

export async function fetchQuejas(params: QuejasParams = {}, signal?: AbortSignal): Promise<QuejasResult> {
  const { page, pageSize, search, estado, prioridad, responsableId } = normalizeQuejasParams(params)
  let query = supabase.from('quejas').select('*', { count: 'exact' })
  if (search) {
    const pattern = containsPattern(search)
    query = query.or(`folio.ilike.${pattern},cliente_nombre.ilike.${pattern}`)
  }
  if (estado) query = query.eq('estado', estado)
  if (prioridad) query = query.eq('prioridad', prioridad)
  if (responsableId) query = query.eq('responsable_id', responsableId)
  query = query
    .order('fecha', { ascending: false })
    .order('id', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1)
  const { data, error, count } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return { data: (data as Queja[]) ?? [], count: count ?? 0 }
}

export function useQuejas(params: QuejasParams = {}, enabled = true) {
  return useQuery({
    queryKey: quejasKey(params),
    queryFn: ({ signal }) => fetchQuejas(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled,
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

export async function fetchQuejaAdjuntos(quejaId: string, signal?: AbortSignal): Promise<QuejaAdjunto[]> {
  if (!quejaId) return []
  const query = supabase
    .from('queja_adjuntos')
    .select('*')
    .eq('queja_id', quejaId)
    .order('created_at', { ascending: false })
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data as QuejaAdjunto[]) ?? []
}

export function useQuejaAdjuntos(quejaId: string) {
  return useQuery({
    queryKey: quejaAdjuntosKey(quejaId),
    queryFn: ({ signal }) => fetchQuejaAdjuntos(quejaId, signal),
    enabled: !!quejaId,
    staleTime: 30_000,
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

export async function fetchSLAConfig(proceso?: string, signal?: AbortSignal): Promise<SLAConfig[]> {
  let query = supabase.from('sla_config').select('*')
  if (proceso) query = query.eq('proceso', proceso)
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data as SLAConfig[]) ?? []
}

export function useSLAConfig(proceso?: string, enabled = true) {
  return useQuery({ queryKey: [...slaConfigKey, proceso ?? 'todos'], queryFn: ({ signal }) => fetchSLAConfig(proceso, signal), enabled })
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

export async function fetchQuejasEstadisticas(signal?: AbortSignal): Promise<QuejasEstadisticas> {
  const query = supabase.rpc('obtener_estadisticas_quejas')
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
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
    queryFn: ({ signal }) => fetchQuejasEstadisticas(signal),
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
