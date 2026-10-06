export interface Queja {
  revision: number
  estado_codigo: string
  estado_nombre: string
  estado_color: import('@/lib/queries/useStageRules').SemanticColor
  plazo_situacion: import('@/lib/queries/useDeadlineDashboard').DeadlineStatus
  plazo_dias: number | null
  plazo_vence: string | null
  plazo_etapa: string | null
  id: string
  folio: string
  cliente_nombre: string
  email_cliente?: string
  telefono?: string
  categoria: string
  descripcion?: string
  prioridad: string
  estado: string
  fecha: string
  fecha_sla?: string
  fecha_limite_investigacion?: string
  fecha_cierre?: string
  resolucion?: string
  notas?: string
  responsable_id?: string
  derivado_sacp_id?: string
}
