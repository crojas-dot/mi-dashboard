'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import type { Permiso } from '@/lib/permisos'

export const permisosKey = queryKeys.permisos

export async function fetchPermisos(): Promise<Permiso[]> {
  const { data, error } = await supabase
    .from('permisos')
    .select('rol, modulo, leer, escribir')
    .order('modulo')
    .order('rol')
  if (error) throw error
  return (data as Permiso[]) ?? []
}

export async function fetchPermisosByRol(rol: string): Promise<Permiso[]> {
  const { data, error } = await supabase
    .from('permisos')
    .select('rol, modulo, leer, escribir')
    .eq('rol', rol)
    .order('modulo')
  if (error) throw error
  return (data as Permiso[]) ?? []
}

export function usePermisos() {
  return useQuery({
    queryKey: permisosKey,
    queryFn: fetchPermisos,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}

export function useActualizarPermiso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (permiso: Permiso) => {
      const { error } = await supabase
        .from('permisos')
        .upsert({ rol: permiso.rol, modulo: permiso.modulo, leer: permiso.leer, escribir: permiso.escribir })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permisosKey })
    },
  })
}