import { apiFetch } from '@/lib/services/apiClient'
import { createHttpError } from '@/lib/errors/httpError'
import type { UserMutationResult } from '@/lib/types/access'

/** Una mutación no se reintenta: puede haber escrito antes de perder la respuesta. */
export async function mutateUsuario(
  method: 'POST' | 'PATCH' | 'DELETE',
  payload: Record<string, unknown>,
  fallback: string,
  signal?: AbortSignal,
): Promise<UserMutationResult> {
  const response = await apiFetch('/api/usuarios', {
    method,
    body: JSON.stringify(payload),
    signal,
  })
  const data = await response.json().catch(() => null)
  if (response.ok) return data ?? {}
  throw createHttpError(response.status, data?.error, fallback)
}

export const CORREO_ACCESO_CONFIRMADO = 'Correo enviado al servicio de entrega.'

export async function gestionarAccesoUsuario(authId: string, action: 'resend' | 'reset' | 'reset_mfa'): Promise<UserMutationResult> {
  const response = await apiFetch('/api/usuarios/acceso', { method: 'POST', body: JSON.stringify({ authId, action, confirm: true }) })
  const value = await response.json().catch(() => null)
  if (!response.ok) throw createHttpError(response.status, value?.error, 'No se pudo actualizar el acceso')
  return value ?? {}
}
