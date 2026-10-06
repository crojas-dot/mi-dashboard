/** Una fila por módulo con registros propios. Mis Quejas es otra vista de
 * Quejas; Reportería y Configuración no son expedientes y no se suman.
 * El orden y el color de CoreUI se comparten entre gráfico y enlaces.
 */
export const DASHBOARD_MODULES = [
  { id: 'quejas', tabla: 'quejas', nombre: 'Quejas', ruta: '/quejas', color: 'danger' },
  { id: 'sacp', tabla: 'acciones', nombre: 'SACP', ruta: '/sacp', color: 'warning' },
  { id: 'documentos', tabla: 'documentos', nombre: 'Documentos', ruta: '/documentos', color: 'info' },
  { id: 'riesgos', tabla: 'riesgos', nombre: 'Riesgos', ruta: '/riesgos', color: 'purple' },
  { id: 'auditorias', tabla: 'auditorias', nombre: 'Auditorías', ruta: '/auditorias', color: 'primary' },
  { id: 'procesos', tabla: 'procesos', nombre: 'Procesos', ruta: '/procesos', color: 'success' },
  { id: 'revision', tabla: 'reuniones', nombre: 'Revisión por Dirección', ruta: '/revision', color: 'secondary' },
] as const

export type DashboardModule = typeof DASHBOARD_MODULES[number]
