'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPagina, paginaKey, type Pagina } from './pagination'
import { queryKeys } from './queryKeys'

export interface Documento {
  id: string
  codigo_doc?: string
  titulo: string
  version_actual?: string
  estado: string
  fecha_publicacion?: string
  categoria?: string
}

export const documentosKey = queryKeys.documentos

export async function fetchDocumentos(page = 0, estado = ''): Promise<Pagina<Documento>> {
  return fetchPagina<Documento>('documentos', 'created_at', page, estado)
}

export function useDocumentos(page = 0, estado = '') {
  return useQuery({ queryKey: paginaKey(documentosKey, page, estado), queryFn: () => fetchDocumentos(page, estado) })
}
