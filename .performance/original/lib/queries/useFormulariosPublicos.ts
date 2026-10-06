'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface FormularioPublico {
  id: string
  modulo: string
  nombre: string
  token: string
  activo: boolean
  creado_por?: string | null
  created_at: string
}

export const formulariosKey = [...queryKeys.configuraciones, 'formularios'] as const

export async function fetchFormulariosPublicos(): Promise<FormularioPublico[]> {
  const { data, error } = await supabase
    .from('formularios_publicos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as FormularioPublico[]) ?? []
}

export function useFormulariosPublicos() {
  return useQuery({ queryKey: formulariosKey, queryFn: fetchFormulariosPublicos })
}

export function useCrearFormularioPublico() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ nombre, creadoPor }: { nombre: string; creadoPor?: string | null }) => {
      const { data, error } = await supabase
        .from('formularios_publicos')
        .insert([{ modulo: 'quejas', nombre, activo: true, creado_por: creadoPor || null }])
        .select()
        .single()
      if (error) throw error
      return data as FormularioPublico
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formulariosKey }),
  })
}

export function useToggleFormularioPublico() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from('formularios_publicos')
        .update({ activo })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formulariosKey }),
  })
}

export function useEliminarFormularioPublico() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('formularios_publicos')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formulariosKey }),
  })
}
