'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { normalizarZonaHoraria } from '@/lib/timeZone'
import { retryRead } from '@/lib/errors/userError'

export const zonaHorariaKey = ['configuraciones_sistema', 'org.zona_horaria'] as const

async function autorizacion(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('La sesión no está disponible. Vuelve a iniciar sesión.')
  return data.session.access_token
}

async function solicitar(method: 'GET' | 'PUT', zonaHoraria?: string, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted()
  const token = await autorizacion()
  signal?.throwIfAborted()
  const respuesta = await fetch('/api/configuracion/zona-horaria', {
    method,
    signal,
    headers: { Authorization: `Bearer ${token}`, ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'PUT' ? { body: JSON.stringify({ zonaHoraria }) } : {}),
    cache: 'no-store',
  })
  const body = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw Object.assign(new Error(body?.error || 'No se pudo consultar la zona horaria'), { status: respuesta.status })
  return normalizarZonaHoraria(body?.zonaHoraria)
}

export function useZonaHoraria(enabled = true) {
  return useQuery({ queryKey: zonaHorariaKey, queryFn: ({ signal }) => solicitar('GET', undefined, signal),
    staleTime: 5 * 60 * 1000, retry: retryRead, enabled })
}

export function guardarZonaHoraria(zonaHoraria: string) {
  return solicitar('PUT', zonaHoraria)
}
