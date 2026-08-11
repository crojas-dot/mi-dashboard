'use client'

import { useQuery } from '@tanstack/react-query'
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

export interface DashboardData {
  indicadores: Indicador[]
  tareas: TareaPendiente[]
}

export const dashboardKey = queryKeys.dashboard

export async function fetchDashboard(): Promise<DashboardData> {
  const [qRes, aRes, docsRes, riesgosRes] = await Promise.all([
    supabase.from('quejas').select('id, folio, cliente_nombre, fecha_sla, estado, prioridad', { count: 'exact', head: false }).neq('estado', 'Cerrada').limit(5),
    supabase.from('acciones').select('id, folio, tipo, descripcion, fecha_limite, estado', { count: 'exact', head: false }).neq('estado', 'Cerrada').limit(5),
    supabase.from('documentos').select('id, titulo, estado', { count: 'exact', head: true }).eq('estado', 'Borrador'),
    supabase.from('riesgos').select('id, titulo', { count: 'exact', head: true }).eq('estado', 'Activo'),
  ])

  type QuejaResumen = { id: string; folio: string; cliente_nombre: string; fecha_sla?: string | null; estado: string }
  type AccionResumen = { id: string; folio?: string | null; tipo: string; descripcion?: string | null; fecha_limite?: string | null; estado: string }

  const tareas = [
    ...(qRes.data ?? [] as QuejaResumen[]).map((q) => ({ id: q.id, titulo: q.cliente_nombre || q.folio, tipo: 'Queja', entidad: 'Quejas', vence: q.fecha_sla || '', estado: q.estado })),
    ...(aRes.data ?? [] as AccionResumen[]).map((a) => ({ id: a.id, titulo: a.folio || a.descripcion?.slice(0, 60) || '', tipo: a.tipo, entidad: 'SACP', vence: a.fecha_limite || '', estado: a.estado })),
  ].sort((a, b) => { if (!a.vence) return 1; if (!b.vence) return -1; return new Date(a.vence).getTime() - new Date(b.vence).getTime() }).slice(0, 8)

  const indicadores = [
    { label: 'Quejas Abiertas', valor: qRes.count ?? 0, color: '#dc3545', url: '/quejas' },
    { label: 'SACP en Proceso', valor: aRes.count ?? 0, color: '#fd7e14', url: '/sacp' },
    { label: 'Docs. en Borrador', valor: docsRes.count ?? 0, color: '#0d6efd', url: '/documentos' },
    { label: 'Riesgos Activos', valor: riesgosRes.count ?? 0, color: '#198754', url: '/riesgos' },
  ]

  return { indicadores, tareas }
}

export function useDashboard() {
  return useQuery({ queryKey: dashboardKey, queryFn: fetchDashboard })
}
