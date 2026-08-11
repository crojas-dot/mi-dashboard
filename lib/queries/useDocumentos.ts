'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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

export async function fetchDocumentos(): Promise<Documento[]> {
  const { data, error } = await supabase.from('documentos').select('*')
  if (error) throw error
  return (data as Documento[]) ?? []
}

export function useDocumentos() {
  return useQuery({ queryKey: documentosKey, queryFn: fetchDocumentos })
}
