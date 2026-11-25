'use client'

import { useQueries, useQuery, type QueryFunctionContext } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import { dashboardPeriod, summarizeDashboard, type DashboardPeriod, type DashboardCase, type DashboardEvent, type DashboardRun } from '@/lib/utils/dashboardQuejas'
import { getQuejaDeadlineDate, type QuejaConPlazo } from '@/lib/utils/quejaDeadline'

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

type QuejaResumen = QuejaConPlazo & { id: string; folio: string; cliente_nombre: string }
type AccionResumen = { id: string; folio?: string | null; tipo: string; descripcion?: string | null; fecha_limite?: string | null; estado: string }

function organizarTareas(quejas: QuejaResumen[], acciones: AccionResumen[]): TareaPendiente[] {
  return ordenarTareas([
    ...quejas.map((q) => ({ id: q.id, titulo: q.cliente_nombre || q.folio, tipo: 'Queja', entidad: 'Quejas', vence: getQuejaDeadlineDate(q) || '', estado: q.estado })),
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
  quejas: { label: 'Quejas Abiertas', color: '#dc3545', url: '/quejas', table: 'qms_quejas' },
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
  const columns = recurso === 'quejas' ? 'id, folio, cliente_nombre, fecha_sla, fecha_limite_investigacion, plazo_vence, estado'
    : recurso === 'acciones' ? 'id, folio, tipo, descripcion, fecha_limite, estado' : 'id'
  let consulta = supabase.from(config.table).select(columns, { count: 'exact', head: !conTareas })
  if (recurso === 'quejas') consulta = consulta.not('estado', 'in', '(Finalizado,"No Procede",Cerrada)')
    .order('plazo_vence', { ascending: true, nullsFirst: false }).order('id').limit(8)
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

function legacyResourceOptions() {
  return (Object.keys(recursos) as DashboardRecurso[]).map(dashboardResourceOptions)
}

export function dashboardPrefetchOptions() {
  return [dashboardQuejasOptions(dashboardPeriod('year'))]
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
  const resultados = useQueries({ queries: legacyResourceOptions() })
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

const PAGE_SIZE = 500
const CASE_COLUMNS = 'id,fecha,tipo,categoria,estado,area_afectada'
const RUN_COLUMNS = 'id,case_id,stage_id,started_at,expires_at,ended_at,end_event,provenance'
const STAGE_IDS = ['quejas.evaluation', 'quejas.investigation']
export const dashboardQuejasKey = [...queryKeys.dashboard, 'quejas-ejecutivo'] as const

// Paginación estable y proyección mínima: no se descargan contactos, descripciones,
// informes ni snapshots. Todas las lecturas usan el mismo cliente autenticado/RLS.
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>, signal: AbortSignal): Promise<T[]> {
  const result: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    signal.throwIfAborted()
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw error
    signal.throwIfAborted()
    const batch = (data ?? []) as T[]
    result.push(...batch)
    if (batch.length < PAGE_SIZE) return result
  }
}
const chunks = (ids: string[]) => Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, i * 100 + 100))

export async function fetchDashboardQuejas(period: DashboardPeriod, signal: AbortSignal) {
  const previousStart = String(period.year - 1) + '-01-01T00:00:00-06:00'
  const previousEnd = String(period.year) + '-01-01T00:00:00-06:00'
  const [cohort, events, completed, previous] = await Promise.all([
    readAll<DashboardCase>((a, b) => supabase.from('qms_quejas').select(CASE_COLUMNS)
      .gte('fecha', period.start).lt('fecha', period.end).order('id').range(a, b).abortSignal(signal), signal),
    readAll<DashboardEvent>((a, b) => supabase.from('qms_case_events').select('id,case_id,occurred_at')
      .eq('module', 'quejas').eq('kind', 'resolved').eq('provenance', 'observed')
      .gte('occurred_at', period.start).lt('occurred_at', period.end).order('id').range(a, b).abortSignal(signal), signal),
    readAll<DashboardRun>((a, b) => supabase.from('qms_stage_runs').select(RUN_COLUMNS)
      .in('stage_id', STAGE_IDS).gte('ended_at', period.start).lt('ended_at', period.end)
      .order('id').range(a, b).abortSignal(signal), signal),
    supabase.from('qms_quejas').select('id').gte('fecha', previousStart).lt('fecha', previousEnd).limit(1).abortSignal(signal),
  ])
  if (previous.error) throw previous.error
  const ids = [...new Set(events.map(event => event.case_id))]
  const cohortIds = new Set(cohort.map(q => q.id))
  const other: DashboardCase[] = []
  const history: DashboardRun[] = []
  // Incluye cierres de ingresos anteriores y ejecuciones iniciadas/terminadas
  // antes del período. Lotes pequeños, sin lanzar cientos de requests en paralelo.
  for (const batch of chunks(ids)) {
    const missing = batch.filter(id => !cohortIds.has(id))
    const [extra, runs] = await Promise.all([
      missing.length ? readAll<DashboardCase>((a, b) => supabase.from('qms_quejas').select(CASE_COLUMNS)
        .in('id', missing).order('id').range(a, b).abortSignal(signal), signal) : Promise.resolve([]),
      readAll<DashboardRun>((a, b) => supabase.from('qms_stage_runs').select(RUN_COLUMNS)
        .eq('stage_id', 'quejas.investigation').in('case_id', batch)
        .lt('ended_at', period.end).order('id').range(a, b).abortSignal(signal), signal),
    ])
    other.push(...extra); history.push(...runs)
  }
  const runs = [...new Map([...completed, ...history].map(run => [run.id, run])).values()]
  return { metrics: summarizeDashboard(period, [...cohort, ...other], events, runs), hasPrevious: !!previous.data?.length }
}

export function dashboardQuejasOptions(period: DashboardPeriod) {
  return {
    queryKey: [...dashboardQuejasKey, period.start, period.end] as const,
    queryFn: ({ signal }: QueryFunctionContext) => fetchDashboardQuejas(period, signal),
    staleTime: 60_000,
  }
}
export function useDashboardQuejas(period: DashboardPeriod, active: boolean) {
  return useQuery({ ...dashboardQuejasOptions(period), enabled: active })
}
