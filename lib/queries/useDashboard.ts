'use client'

import { useQueries, useQuery, type QueryFunctionContext } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface Indicador {
  label: string
  valor: number
  color: string
  url: string
}

export interface TareaPendiente {
  id: string
  titulo: string
  tipo: string
  entidad: string
  vence: string
  estado: string
}

export const dashboardKey = queryKeys.dashboard

type QuejaResumen = { id: string; folio: string; cliente_nombre: string; fecha_sla?: string | null; estado: string }
type AccionResumen = { id: string; folio?: string | null; tipo: string; descripcion?: string | null; fecha_limite?: string | null; estado: string }

function organizarTareas(quejas: QuejaResumen[], acciones: AccionResumen[]): TareaPendiente[] {
  return ordenarTareas([
    ...quejas.map((q) => ({ id: q.id, titulo: q.cliente_nombre || q.folio, tipo: 'Queja', entidad: 'Quejas', vence: q.fecha_sla || '', estado: q.estado })),
    ...acciones.map((a) => ({ id: a.id, titulo: a.folio || a.descripcion?.slice(0, 60) || '', tipo: a.tipo, entidad: 'SACP', vence: a.fecha_limite || '', estado: a.estado })),
  ])
}

function ordenarTareas(tareas: TareaPendiente[]): TareaPendiente[] {
  return tareas.sort((a, b) => {
    if (!a.vence && !b.vence) return a.id.localeCompare(b.id)
    if (!a.vence) return 1
    if (!b.vence) return -1
    return new Date(a.vence).getTime() - new Date(b.vence).getTime() || a.id.localeCompare(b.id)
  }).slice(0, 8)
}

const recursos = {
  quejas: { label: 'Quejas Abiertas', color: '#dc3545', url: '/quejas', table: 'quejas' },
  acciones: { label: 'SACP en Proceso', color: '#fd7e14', url: '/sacp', table: 'acciones' },
  documentos: { label: 'Docs. en Borrador', color: '#0d6efd', url: '/documentos', table: 'documentos' },
  riesgos: { label: 'Riesgos Activos', color: '#198754', url: '/riesgos', table: 'riesgos' },
} as const
type DashboardRecurso = keyof typeof recursos
interface DashboardResourceData { indicador: Indicador; tareas: TareaPendiente[] }

// Una consulta por tabla comparte conteo y filas entre indicadores y tareas.
// Un error documental sigue sin bloquear los expedientes de Quejas/SACP.
async function fetchDashboardResource(recurso: DashboardRecurso, signal?: AbortSignal): Promise<DashboardResourceData> {
  const config = recursos[recurso]
  const conTareas = recurso === 'quejas' || recurso === 'acciones'
  const columns = recurso === 'quejas' ? 'id, folio, cliente_nombre, fecha_sla, estado'
    : recurso === 'acciones' ? 'id, folio, tipo, descripcion, fecha_limite, estado' : 'id'
  let consulta = supabase.from(config.table).select(columns, { count: 'exact', head: !conTareas })
  if (recurso === 'quejas') consulta = consulta.not('estado', 'in', '(Finalizado,"No Procede",Cerrada)')
    .order('fecha_sla', { ascending: true, nullsFirst: false }).order('id').limit(8)
  if (recurso === 'acciones') consulta = consulta.neq('estado', 'Cerrada')
    .order('fecha_limite', { ascending: true, nullsFirst: false }).order('id').limit(8)
  if (recurso === 'documentos') consulta = consulta.eq('estado', 'Borrador')
  if (recurso === 'riesgos') consulta = consulta.eq('estado', 'Activo')
  const { data, count, error } = await (signal ? consulta.abortSignal(signal) : consulta)
  if (error) throw error
  return {
    indicador: { label: config.label, color: config.color, url: config.url, valor: count ?? 0 },
    tareas: recurso === 'quejas' ? organizarTareas((data ?? []) as unknown as QuejaResumen[], [])
      : recurso === 'acciones' ? organizarTareas([], (data ?? []) as unknown as AccionResumen[]) : [],
  }
}

function dashboardResourceOptions(recurso: DashboardRecurso) {
  return {
    queryKey: [...dashboardKey, 'recurso', recurso] as const,
    queryFn: ({ signal }: QueryFunctionContext) => fetchDashboardResource(recurso, signal),
    staleTime: 60 * 1000,
  }
}

export function dashboardPrefetchOptions() {
  return (Object.keys(recursos) as DashboardRecurso[]).map(dashboardResourceOptions)
}

// Compatibilidad para consumidores imperativos. Las vistas usan las opciones
// compartidas y TanStack deduplica transporte, precarga e invalidación.
export async function fetchDashboardIndicadores(signal?: AbortSignal): Promise<Indicador[]> {
  const resultados = await Promise.all((Object.keys(recursos) as DashboardRecurso[])
    .map((recurso) => fetchDashboardResource(recurso, signal)))
  return resultados.map((resultado) => resultado.indicador)
}

export async function fetchDashboardTareas(signal?: AbortSignal): Promise<TareaPendiente[]> {
  const resultados = await Promise.all([fetchDashboardResource('quejas', signal), fetchDashboardResource('acciones', signal)])
  return ordenarTareas(resultados.flatMap((resultado) => resultado.tareas))
}

export function useDashboardIndicadores() {
  const resultados = useQueries({ queries: dashboardPrefetchOptions() })
  return {
    data: resultados.every((resultado) => resultado.data) ? resultados.map((resultado) => resultado.data!.indicador) : undefined,
    isPending: resultados.some((resultado) => resultado.isPending),
    error: resultados.find((resultado) => resultado.error)?.error ?? null,
    refetch: () => Promise.all(resultados.map((resultado) => resultado.refetch())),
  }
}

export function useDashboardTareas() {
  const resultados = useQueries({ queries: [dashboardResourceOptions('quejas'), dashboardResourceOptions('acciones')] })
  return {
    data: resultados.every((resultado) => resultado.data) ? ordenarTareas(resultados.flatMap((resultado) => resultado.data!.tareas)) : undefined,
    isPending: resultados.some((resultado) => resultado.isPending),
    error: resultados.find((resultado) => resultado.error)?.error ?? null,
    refetch: () => Promise.all(resultados.map((resultado) => resultado.refetch())),
  }
}

export function useActividadReciente() {
  return useQuery({
    queryKey: [...dashboardKey, 'actividad'],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('quejas_actividad')
        .select('id, descripcion, created_at').order('created_at', { ascending: false }).order('id').limit(5)
        .abortSignal(signal)
      if (error) throw error
      return data ?? []
    },
  })
}
