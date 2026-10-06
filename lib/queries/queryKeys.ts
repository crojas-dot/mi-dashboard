export const queryKeys = {
  dashboard: ['dashboard'] as const,
  quejas: ['quejas'] as const,
  catalogos: ['catalogos'] as const,
  slaConfig: ['sla_config'] as const,
  configuraciones: ['configuraciones_sistema'] as const,
  acciones: ['acciones'] as const,
  documentos: ['documentos'] as const,
  auditorias: ['auditorias'] as const,
  riesgos: ['riesgos'] as const,
  reuniones: ['reuniones'] as const,
  procesos: ['procesos'] as const,
  usuarios: ['usuarios'] as const,
  permisos: ['permisos'] as const,
  quejasActividad: ['quejas_actividad'] as const,
  notificaciones: ['notificaciones'] as const,
} as const

/**
 * Helper to create scoped query keys for pagination and filtering
 * Usage: queryKeys.quejas, [queryKeys.quejas, { page: 1, status: 'open' }]
 */
export function createQueryKey(base: readonly string[], params?: Record<string, any>) {
  return params ? [...base, params] as const : base
}
