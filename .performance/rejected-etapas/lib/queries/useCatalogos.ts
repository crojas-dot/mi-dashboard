'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface CatalogoValor {
  codigo: string
  valor_interno: string
  id: string
  modulo: string
  tipo: string
  valor: string
  color: string
  orden: number
  activo: boolean | null
}

export const catalogosKey = queryKeys.catalogos

export async function fetchCatalogos(): Promise<CatalogoValor[]> {
  const { data, error } = await supabase
    .from('catalogos')
    .select('*')
    .order('modulo')
    .order('tipo')
    .order('orden')
  if (error) throw error
  return (data as CatalogoValor[]) ?? []
}

export function useCatalogos() {
  return useQuery({
    queryKey: catalogosKey,
    queryFn: fetchCatalogos,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

export function catalogoTipoKey(tipo: string, modulo?: string) {
  return [...queryKeys.catalogos, 'tipo', tipo, modulo ?? ''] as const
}

export async function fetchCatalogoTipo(
  tipo: string,
  modulo?: string,
): Promise<{ valor: string; color: string; codigo: string; valor_interno: string }[]> {
  let query = supabase
    .from('catalogos')
    .select('valor, color, codigo, valor_interno')
    .eq('tipo', tipo)
    .or('activo.is.null,activo.eq.true')
    .order('orden')
  if (modulo) query = query.eq('modulo', modulo)
  const { data, error } = await query
  if (error) throw error
  return (data as { valor: string; color: string; codigo: string; valor_interno: string }[]) ?? []
}

export function useCatalogoTipo(tipo: string, modulo?: string) {
  return useQuery({
    queryKey: catalogoTipoKey(tipo, modulo),
    queryFn: () => fetchCatalogoTipo(tipo, modulo),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}
