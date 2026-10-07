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
  ultimo_acceso?: string | null
}

export const usuariosKey = queryKeys.usuarios

export async function apiFetch(url: string, options: RequestInit = {}) {
  options.signal?.throwIfAborted()
  const { data } = await supabase.auth.getSession()
  options.signal?.throwIfAborted()
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
}, signal?: AbortSignal): Promise<Usuario[]> {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.rol) qs.set('rol', params.rol)
  if (params?.estado) qs.set('estado', params.estado)
  const res = await apiFetch(`/api/usuarios?${qs.toString()}`, { signal })
  if (!res.ok) throw Object.assign(new Error('No se pudo cargar el listado de usuarios'), { status: res.status })
  return (await res.json()) as Usuario[]
}

function normalizeUsuariosParams(params?: {
  search?: string
  rol?: string
  estado?: string
}) {
  return {
    search: params?.search ?? '',
    rol: params?.rol ?? '',
    estado: params?.estado ?? '',
  }
}

export function usuariosQueryKey(params?: Parameters<typeof normalizeUsuariosParams>[0]) {
  return [...usuariosKey, normalizeUsuariosParams(params)] as const
}

export function useUsuarios(
  params?: { search?: string; rol?: string; estado?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: usuariosQueryKey(params),
    queryFn: ({ signal }) => fetchUsuarios(params, signal),
    enabled,
    refetchOnWindowFocus: true,
  })
}
