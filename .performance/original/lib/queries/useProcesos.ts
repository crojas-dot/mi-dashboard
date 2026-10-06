'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPagina, paginaKey, type Pagina } from './pagination'
import { queryKeys } from './queryKeys'

export interface Proceso {
  id: string
  nombre_proceso?: string
  tipo?: string
  objetivo?: string
  responsable_id?: string
  estado: string
  documentos_vinculados?: string
  kpis?: string
}

export const procesosKey = queryKeys.procesos

export async function fetchProcesos(page = 0, estado = ''): Promise<Pagina<Proceso>> {
  return fetchPagina<Proceso>('procesos', 'created_at', page, estado)
}

export function useProcesos(page = 0, estado = '') {
  return useQuery({ queryKey: paginaKey(procesosKey, page, estado), queryFn: () => fetchProcesos(page, estado) })
}
