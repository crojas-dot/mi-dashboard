'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queries/queryKeys'
import { retryRead } from '@/lib/errors/userError'
import { LOGO_CLAVE } from '@/lib/constants/marca'

export const logoEmpresaKey = [...queryKeys.configuraciones, LOGO_CLAVE] as const

async function autorizacion(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('La sesión no está disponible. Vuelve a iniciar sesión.')
  return data.session.access_token
}

function leerLogo(body: unknown): string {
  const valor = (body as { logoUrl?: unknown } | null)?.logoUrl
  return typeof valor === 'string' ? valor : ''
}

async function solicitar(method: 'GET' | 'PUT' | 'DELETE', archivo?: Blob, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted()
  const token = await autorizacion()
  signal?.throwIfAborted()
  let cuerpo: FormData | undefined
  if (archivo) {
    cuerpo = new FormData()
    cuerpo.append('archivo', archivo, 'logo')
  }
  const respuesta = await fetch('/api/configuracion/logo', {
    method, signal, body: cuerpo, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw Object.assign(new Error(body?.error || 'No se pudo actualizar el logo'), { status: respuesta.status })
  return leerLogo(body)
}

/** Lectura compartida por el shell: el logo no lleva datos del usuario ni de negocio. */
export function useLogoEmpresa(enabled = true) {
  return useQuery({
    queryKey: logoEmpresaKey, queryFn: ({ signal }) => solicitar('GET', undefined, signal),
    staleTime: 10 * 60 * 1000, retry: retryRead, enabled,
  })
}

/** Recibe el cuadrado ya recortado y optimizado por el editor de Configuración. */
export function guardarLogoEmpresa(archivo: Blob) {
  return solicitar('PUT', archivo)
}

export function eliminarLogoEmpresa() {
  return solicitar('DELETE')
}
