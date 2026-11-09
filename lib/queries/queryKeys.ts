/**
 * queryKeys — fuente única de prefijos para TanStack Query.
 * Cada hook en lib/queries/ construye sus claves a partir de estos prefijos.
 * Invalidar: queryClient.invalidateQueries({ queryKey: queryKeys.quejas }).
 */
export const queryKeys = {
  publicFormulario: ['publicFormulario'] as const,
  dashboard: ['dashboard'] as const,
  quejas: ['quejas'] as const,
  catalogos: ['catalogos'] as const,
  slaConfig: ['sla_config'] as const,
  qmsCalendar: ['qms_calendar'] as const,
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
