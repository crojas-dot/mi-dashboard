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
}

function normalizeQuejasParams(params: QuejasParams = {}): Required<QuejasParams> {
  return {
    page: params.page ?? 0,
    pageSize: params.pageSize ?? 25,
    search: params.search ?? '',
    estado: params.estado ?? '',
    prioridad: params.prioridad ?? '',
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
  const { page, pageSize, search, estado, prioridad } = normalizeQuejasParams(params)
  let query = supabase.from('quejas').select('*', { count: 'exact' })
  if (search) query = query.or(`folio.ilike.%${search}%,cliente_nombre.ilike.%${search}%`)
  if (estado) query = query.eq('estado', estado)
  if (prioridad) query = query.eq('prioridad', prioridad)
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
  resueltasATiempo: number
  totalDecididas: number
  noProcede: number
  procedencia: number
  porMes: { mes: string; total: number }[]
}

export const quejasEstadisticasKey = [...queryKeys.quejas, 'estadisticas'] as const

export async function fetchQuejasEstadisticas(): Promise<QuejasEstadisticas> {
  const { data, error } = await supabase
    .from('quejas')
    .select('id, estado, fecha, fecha_cierre, fecha_sla')
  if (error) throw error
  const quejas = (data as Queja[]) ?? []

  const decididas = quejas.filter((q) => q.estado !== 'Recibido')
  const noProcede = quejas.filter((q) => q.estado === 'No Procede').length
  const resueltas = quejas.filter((q) => q.estado !== 'Recibido' && q.estado !== 'No Procede')

  let resueltasATiempo = 0
  for (const q of resueltas) {
    if (q.estado !== 'Resuelto' && q.estado !== 'Finalizado') continue
    if (!q.fecha_cierre || !q.fecha_sla) {
      // Sin fecha_sla persistida no se puede comparar; se considera a tiempo
      resueltasATiempo++
      continue
    }
    if (new Date(q.fecha_cierre).getTime() <= new Date(q.fecha_sla).getTime()) resueltasATiempo++
  }

  const porMesMap: Record<string, number> = {}
  for (const q of quejas) {
    const key = (q.fecha || '').slice(0, 7)
    if (!key) continue
    porMesMap[key] = (porMesMap[key] ?? 0) + 1
  }
  const porMes = Object.entries(porMesMap)
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => a.mes.localeCompare(b.mes))

  const totalDecididas = decididas.length
  const procedencia = totalDecididas > 0 ? Math.round(((totalDecididas - noProcede) / totalDecididas) * 100) : 0
  const pctATiempo = resueltas.length > 0 ? Math.round((resueltasATiempo / resueltas.length) * 100) : 0

  return {
    resueltasATiempo: pctATiempo,
    totalDecididas,
    noProcede,
    procedencia,
    porMes: porMes.slice(-6),
  }
}

export function useQuejasEstadisticas() {
  return useQuery({
    queryKey: quejasEstadisticasKey,
    queryFn: fetchQuejasEstadisticas,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}
