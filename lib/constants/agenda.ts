export const MOTIVOS_AGENDA = {
  vence_hoy: { label: 'Vence hoy', variant: 'red', orden: 1, punto: 'bg-red-500' },
  programada_hoy: { label: 'Programada hoy', variant: 'indigo', orden: 2, punto: 'bg-blue-500' },
  devuelto_hoy: { label: 'Devuelta hoy', variant: 'orange', orden: 3, punto: 'bg-blue-500' },
  nueva_asignacion: { label: 'Nueva asignación', variant: 'blue', orden: 4, punto: 'bg-blue-500' },
  revision_hoy: { label: 'Propuesta para revisar', variant: 'indigo', orden: 5, punto: 'bg-blue-500' },
  lista_publicar_hoy: { label: 'Lista para publicar', variant: 'green', orden: 6, punto: 'bg-blue-500' },
  vence_en_1_dia: { label: 'Vence en 1 día hábil', variant: 'amber', orden: 7, punto: 'bg-amber-500' },
  vence_en_2_dias: { label: 'Vence en 2 días hábiles', variant: 'amber', orden: 8, punto: 'bg-amber-500' },
  recibida_hoy: { label: 'Nueva queja por evaluar', variant: 'blue', orden: 9, punto: 'bg-blue-500' },
} as const
export type MotivoAgenda = keyof typeof MOTIVOS_AGENDA
export interface AgendaHoyItem { id: string; codigo: string; descripcion: string; motivo: MotivoAgenda; ruta: string; fecha_limite: string | null }
