import { apiFetch } from '@/lib/services/apiClient'
import type { AccessStatus } from '@/lib/types/access'

export async function fetchAccessStatus(signal?: AbortSignal): Promise<AccessStatus> {
  const response = await apiFetch('/api/auth/acceso', { signal })
  if (!response.ok) throw new Error('No se pudo verificar la configuración de acceso.')
  return response.json()
}
export async function accessAction<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await apiFetch('/api/auth/acceso', { method: 'POST', body: JSON.stringify(payload) })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? 'No se pudo completar la operación.')
  return data as T
}
