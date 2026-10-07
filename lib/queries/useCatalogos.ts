'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface CatalogoValor {
  id: string
  modulo: string
  tipo: string
  valor: string
  color: string
  orden: number
  activo: boolean | null
}

export const catalogosKey = queryKeys.catalogos

export async function fetchCatalogos(signal?: AbortSignal): Promise<CatalogoValor[]> {
  const query = supabase
    .from('catalogos')
    .select('*')
    .order('modulo')
    .order('tipo')
    .order('orden')
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data as CatalogoValor[]) ?? []
}

export function useCatalogos(enabled = true) {
  return useQuery({ queryKey: catalogosKey, queryFn: ({ signal }) => fetchCatalogos(signal), enabled })
}

export function catalogoTipoKey(tipo: string, modulo?: string) {
  return [...queryKeys.catalogos, 'tipo', tipo, modulo ?? ''] as const
}

export async function fetchCatalogoTipo(
  tipo: string,
  modulo?: string,
  signal?: AbortSignal,
): Promise<{ valor: string; color: string }[]> {
  let query = supabase
    .from('catalogos')
    .select('valor, color')
    .eq('tipo', tipo)
    .or('activo.is.null,activo.eq.true')
    .order('orden')
  if (modulo) query = query.eq('modulo', modulo)
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data as { valor: string; color: string }[]) ?? []
}

export function useCatalogoTipo(tipo: string, modulo?: string) {
  return useQuery({
    queryKey: catalogoTipoKey(tipo, modulo),
    queryFn: ({ signal }) => fetchCatalogoTipo(tipo, modulo, signal),
  })
}
