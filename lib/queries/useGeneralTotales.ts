'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import { retryRead } from '@/lib/errors/userError'
import type { DashboardModule } from '@/lib/constants/dashboardModules'

export const generalTotalesKey = [...queryKeys.dashboard, 'totales'] as const
export interface TotalModulo { id: DashboardModule['id']; total: number }

/** Solo COUNT exacto con HEAD: siete números, ninguna fila de negocio.
 * Se consultan únicamente los módulos visibles para el rol/vista actual.
 */
export async function fetchGeneralTotales(modulos: readonly DashboardModule[], signal?: AbortSignal): Promise<TotalModulo[]> {
  return Promise.all(modulos.map(async (modulo) => {
    let consulta = supabase.from(modulo.tabla).select('id', { count: 'exact', head: true })
    if (signal) consulta = consulta.abortSignal(signal)
    const { count, error } = await consulta
    if (error) throw error
    if (count === null) throw new Error(`No se pudo contar ${modulo.nombre}`)
    return { id: modulo.id, total: count }
  }))
}

export function useGeneralTotales(modulos: readonly DashboardModule[]) {
  return useQuery({
    queryKey: [...generalTotalesKey, modulos.map((modulo) => modulo.id)],
    queryFn: ({ signal }) => fetchGeneralTotales(modulos, signal),
    enabled: modulos.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: retryRead,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}
