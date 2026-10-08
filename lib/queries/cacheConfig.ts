/**
 * cacheConfig — TTLs de TanStack Query por dominio de datos.
 * staleTime: cuánto tiempo la data se considera fresca (no re-fetch en mount).
 * gcTime: cuánto se mantiene en memoria tras perder todos los observers.
 * getCacheConfig() resuelve el tier correcto desde el primer segmento del queryKey.
 * Ejemplo: queryKey=['quejas', {page:0}] → CACHE_CONFIG.quejas.
 */
import type { QueryKey } from '@tanstack/react-query'

export const CACHE_CONFIG = {
  dashboard: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
  quejas: { staleTime: 30 * 1000, gcTime: 3 * 60 * 1000 },
  notificaciones: { staleTime: 15 * 1000, gcTime: 60 * 1000 },
  configuraciones: { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  default: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
}

export function getCacheConfig(queryKey: QueryKey) {
  const key = String(queryKey[0] ?? '')
  if (['configuraciones_sistema', 'catalogos', 'sla_config', 'permisos'].includes(key)) return CACHE_CONFIG.configuraciones
  if (key === 'quejas_actividad') return CACHE_CONFIG.quejas
  return CACHE_CONFIG[key as keyof typeof CACHE_CONFIG] ?? CACHE_CONFIG.default
}
