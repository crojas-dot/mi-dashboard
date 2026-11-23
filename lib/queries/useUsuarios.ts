'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/services/apiClient'
import { queryKeys } from './queryKeys'
import type { UserAccessDirectory } from '@/lib/types/access'

export interface Usuario {
  id: string
  email: string
  nombre: string
  rol: string
  estado: string
  auth_id?: string
  ultimo_acceso?: string | null
  access?: UserAccessDirectory
}

export const usuariosKey = queryKeys.usuarios

// Compatibilidad con los consumidores anteriores del transporte.
export { apiFetch } from '@/lib/services/apiClient'

export async function fetchUsuarios(params?: {
  search?: string
  rol?: string
  estado?: string
}, signal?: AbortSignal): Promise<Usuario[]> {
  const { search, rol, estado } = normalizeUsuariosParams(params)
  const qs = new URLSearchParams()
  if (search) qs.set('search', search)
  if (rol) qs.set('rol', rol)
  if (estado) qs.set('estado', estado)
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
    search: params?.search?.trim() ?? '',
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
    placeholderData: keepPreviousData,
    enabled,
    refetchOnWindowFocus: true,
  })
}
