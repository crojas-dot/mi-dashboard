'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import type { Permiso } from '@/lib/permisos'

export const permisosKey = queryKeys.permisos

export async function fetchPermisos(signal?: AbortSignal): Promise<Permiso[]> {
  const query = supabase
    .from('permisos')
    .select('rol, modulo, leer, escribir')
    .order('modulo')
    .order('rol')
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data as Permiso[]) ?? []
}

export async function fetchPermisosByRol(rol: string, signal?: AbortSignal): Promise<Permiso[]> {
  const query = supabase
    .from('permisos')
    .select('rol, modulo, leer, escribir')
    .eq('rol', rol)
    .order('modulo')
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data as Permiso[]) ?? []
}

export function usePermisos(enabled = true) {
  return useQuery({
    queryKey: permisosKey,
    queryFn: ({ signal }) => fetchPermisos(signal),
    enabled,
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
