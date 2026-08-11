'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export interface Usuario {
  id: string
  email: string
  nombre: string
  rol: string
  estado: string
  auth_id?: string
  ultimo_acceso?: string
}

export const usuariosKey = queryKeys.usuarios

export async function apiFetch(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

export async function fetchUsuarios(params?: {
  search?: string
  rol?: string
  estado?: string
}): Promise<Usuario[]> {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.rol) qs.set('rol', params.rol)
  if (params?.estado) qs.set('estado', params.estado)
  const res = await apiFetch(`/api/usuarios?${qs.toString()}`)
  if (!res.ok) throw new Error('No tienes permisos para ver usuarios')
  return (await res.json()) as Usuario[]
}

export function useUsuarios(params?: {
  search?: string
  rol?: string
  estado?: string
}) {
  return useQuery({
    queryKey: [...usuariosKey, params],
    queryFn: () => fetchUsuarios(params),
  })
}
