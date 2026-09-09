'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPagina, paginaKey, type Pagina } from './pagination'
import { queryKeys } from './queryKeys'

export interface SACP {
  id: string
  folio?: string
  tipo: string
  descripcion: string
  estado: string
  prioridad?: string
  fecha_limite?: string
  responsable_id?: string
  seguimiento_porcentaje?: number
  eficacia?: string
  notas?: string
  fecha_apertura?: string
}

export const accionesKey = queryKeys.acciones

export async function fetchAcciones(page = 0, estado = ''): Promise<Pagina<SACP>> {
  return fetchPagina<SACP>('acciones', 'fecha_apertura', page, estado)
}

export function useSACP(page = 0, estado = '') {
  return useQuery({ queryKey: paginaKey(accionesKey, page, estado), queryFn: () => fetchAcciones(page, estado) })
}
