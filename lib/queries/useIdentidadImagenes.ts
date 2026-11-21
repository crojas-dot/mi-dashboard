'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { IDENTIDAD_IMAGENES, IDENTIDAD_SLOTS, type ImagenIdentidad } from '@/lib/constants/identidad'
import { emailLogoStyle, type EmailLogoStyle } from '@/supabase/functions/_shared/emailIdentity'

export const identidadImagenesKey = ['identidad', 'imagenes'] as const
export type ImagenesIdentidad = Record<ImagenIdentidad, string> & {
  configuradas?: Partial<Record<ImagenIdentidad, boolean>>
  emailLogoStyle?: EmailLogoStyle
}

export async function fetchImagenesIdentidad(signal?: AbortSignal): Promise<ImagenesIdentidad> {
  const response = await fetch('/api/configuracion/identidad', { cache: 'no-store', signal })
  if (!response.ok) throw new Error('No se pudieron cargar las imágenes institucionales')
  const body = await response.json() as {
    imagenes?: Record<string, unknown>
    configuradas?: Record<string, unknown>
    emailLogoStyle?: unknown
  }
  return {
    ...Object.fromEntries(IDENTIDAD_SLOTS.map(slot => [
      slot, typeof body.imagenes?.[slot] === 'string' ? body.imagenes[slot] : '',
    ])),
    configuradas: Object.fromEntries(IDENTIDAD_SLOTS.map(slot => [
      slot, body.configuradas?.[slot] === true,
    ])),
    emailLogoStyle: emailLogoStyle(body.emailLogoStyle),
  } as ImagenesIdentidad
}

export function useIdentidadImagenes(active = true) {
  return useQuery({
    queryKey: identidadImagenesKey,
    queryFn: ({ signal }) => fetchImagenesIdentidad(signal),
    enabled: active,
    staleTime: 60_000,
    retry: 1,
  })
}

async function tokenAdmin() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Iniciá sesión para administrar las imágenes')
  return data.session.access_token
}

export async function guardarEstiloLogoCorreo(emailLogoStyle: EmailLogoStyle) {
  const response = await fetch('/api/configuracion/identidad', {
    method: 'PATCH', cache: 'no-store',
    headers: { Authorization: `Bearer ${await tokenAdmin()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailLogoStyle }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'No se pudo guardar el estilo de correo')
}

export async function guardarImagenIdentidad(slot: ImagenIdentidad, blob: Blob) {
  if (!IDENTIDAD_IMAGENES[slot]) throw new Error('Imagen no reconocida')
  const form = new FormData()
  form.append('slot', slot)
  form.append('archivo', blob, blob.type === 'image/png' ? 'imagen.png' : 'imagen.webp')
  const res = await fetch('/api/configuracion/identidad', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${await tokenAdmin()}` },
    body: form,
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || 'No se pudo guardar la imagen')
  return body.imagen as string
}

export async function quitarImagenIdentidad(slot: ImagenIdentidad) {
  const res = await fetch('/api/configuracion/identidad', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await tokenAdmin()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot }),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || 'No se pudo quitar la imagen')
}
