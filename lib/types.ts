export interface Queja {
  id: string
  revision: number
  folio: string
  cliente_nombre: string
  email_cliente?: string
  telefono?: string
  categoria: string
  descripcion?: string
  tipo?: string | null
  area_afectada?: string | null
  fecha_recepcion_gc?: string | null
  numero_oficio_resolucion?: string | null
  observaciones?: string | null
  prioridad?: string | null
  estado: string
  fecha: string
  fecha_sla?: string
  fecha_limite_investigacion?: string
  fecha_cierre?: string
  resolucion?: string
  resolucion_formato?: 'plain' | 'markdown'
  notas?: string
  notas_formato?: 'plain' | 'markdown'
  justificacion_procede?: string | null
  justificacion_procede_formato?: 'plain' | 'markdown'
  estado_nombre?: string
  estado_color?: string
  plazo_vence?: string | null
  plazo_etapa?: string | null
  plazo_situacion?: string | null
  plazo_dias?: number | null
  responsable_id?: string
  derivado_sacp_id?: string
}
