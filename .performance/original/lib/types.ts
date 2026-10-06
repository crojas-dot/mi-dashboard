export interface Queja {
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
