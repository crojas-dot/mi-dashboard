import { apiFetch } from '@/lib/services/apiClient'
import type { AIProvider, AIRouting, TestResultado } from '@/lib/ai/types'
import { createHttpError } from '@/lib/errors/httpError'

async function call<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(url, options)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw createHttpError(response.status, data?.error, 'No se pudo completar la configuración IA.')
  return data as T
}

export function cargarConfigIA(signal?: AbortSignal) {
  return call<{ providers: AIProvider[]; routing: AIRouting; ttl: number; revision: string }>(
    '/api/configuracion/ia', { signal },
  )
}

export async function leerConfigIA(clave: string) {
  const data = await call<{ valor: unknown }>('/api/configuracion/ia?clave=' + encodeURIComponent(clave))
  return data.valor
}

export async function guardarConfigIA(clave: string, valor: unknown) {
  const data = await call<{ valor: unknown }>('/api/configuracion/ia', {
    method: 'PUT', body: JSON.stringify({ clave, valor }),
  })
  return data.valor
}

export function guardarProveedoresIA(providers: AIProvider[], expectedRevision: string, resetTokens: string[] = []) {
  return call<{ valor: AIProvider[]; revision: string }>('/api/configuracion/ia', {
    method: 'PUT', body: JSON.stringify({ clave: 'ai_providers', valor: providers, resetTokens, expectedRevision }),
  })
}

export function modelosIA(providerId: string) {
  return call<{ modelos: string[]; total: number; descartados: number }>('/api/configuracion/ia', {
    method: 'POST', body: JSON.stringify({ action: 'models', providerId }),
  })
}

export function conectarIA(provider: AIProvider) {
  return call<{ ok: boolean }>('/api/configuracion/ia', {
    method: 'POST', body: JSON.stringify({ action: 'connect', provider }),
  })
}

export function limpiarMemoriaIA(providerId: string, modelos: string[]) {
  return call('/api/configuracion/ia', { method: 'POST', body: JSON.stringify({ action: 'cleanMemory', providerId, modelos }) })
}

export async function modelosSinFallos(providerId: string, modelos: string[]) {
  const result = await leerConfigIA('ai_test_resultado_' + providerId) as TestResultado | null
  const failed = new Set((result?.resultados ?? []).filter(value => !value.ok).map(value => value.modelo))
  return modelos.filter(value => !failed.has(value))
}
