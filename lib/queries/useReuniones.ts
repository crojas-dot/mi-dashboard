'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPagina, paginaKey, type Pagina } from './pagination'
import { queryKeys } from './queryKeys'

export interface Reunion {
  id: string
  titulo: string
  fecha_programada?: string
  participantes?: string
  agenda?: string
  estado: string
  acta_drive_id?: string
}

export const reunionesKey = queryKeys.reuniones

export async function fetchReuniones(page = 0, estado = '', signal?: AbortSignal): Promise<Pagina<Reunion>> {
  return fetchPagina<Reunion>('reuniones', 'created_at', page, estado, signal)
}

export function useReuniones(page = 0, estado = '') {
  return useQuery({ queryKey: paginaKey(reunionesKey, page, estado), queryFn: ({ signal }) => fetchReuniones(page, estado, signal) })
}
