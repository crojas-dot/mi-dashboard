import { apiFetch } from '@/lib/services/apiClient'
import { createHttpError } from '@/lib/errors/httpError'

/** Una mutación no se reintenta: puede haber escrito antes de perder la respuesta. */
export async function mutateUsuario(
  method: 'POST' | 'PATCH' | 'DELETE',
  payload: Record<string, unknown>,
  fallback: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await apiFetch('/api/usuarios', {
    method,
    body: JSON.stringify(payload),
    signal,
  })
  if (response.ok) return
  const data = await response.json().catch(() => null)
  throw createHttpError(response.status, data?.error, fallback)
}
