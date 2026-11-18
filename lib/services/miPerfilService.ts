import { AVATAR_ENDPOINT, AVATAR_STORED_BYTES } from '@/lib/constants/avatar'
import { supabase } from '@/lib/supabase'

/** Fija las credenciales de la cuenta que abrió el perfil, aunque cambie otra pestaña. */
export async function tokenPerfil(authId: string | null): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !authId || data.session?.user.id !== authId) throw new Error('La sesión cambió. Volvé a abrir tu perfil.')
  return data.session.access_token
}

export async function leerFotoPerfil(authId: string | null, signal: AbortSignal, version?: string | null): Promise<Blob> {
  signal.throwIfAborted()
  const token = await tokenPerfil(authId)
  signal.throwIfAborted()
  // El URL cambia con cada foto: la caché HTTP privada nunca reutiliza una
  // versión anterior ni cruza identidades (Vary: Authorization en el servidor).
  const suffix = version?.split('/').at(-1) ?? 'actual'
  const response = await fetch(`${AVATAR_ENDPOINT}?v=${encodeURIComponent(suffix)}`, {
    headers: { Authorization: `Bearer ${token}` }, signal, cache: 'default',
  })
  if (!response.ok) throw Object.assign(new Error('Foto no disponible'), { status: response.status })
  const photo = await response.blob()
  if (photo.type !== 'image/webp' || photo.size > AVATAR_STORED_BYTES) throw new Error('Foto no disponible')
  return photo
}

export async function cambiarFotoPerfil(token: string, file: File | null): Promise<string | null> {
  const response = await fetch(AVATAR_ENDPOINT, {
    method: file ? 'PUT' : 'DELETE', body: file,
    headers: { Authorization: `Bearer ${token}`, ...(file ? { 'Content-Type': file.type } : {}) },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw Object.assign(new Error(body?.error ?? 'No se pudo actualizar tu foto'), { status: response.status })
  return typeof body?.avatarUrl === 'string' ? body.avatarUrl : null
}

export async function cambiarClavePerfil(token: string, password: string) {
  // La operación propia de Auth usa el Bearer capturado y conserva esa sesión.
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT', cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!response.ok) throw new Error('No se pudo cambiar la contraseña')
}
