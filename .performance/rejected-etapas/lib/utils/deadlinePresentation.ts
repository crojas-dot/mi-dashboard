import type { DeadlineStatus } from '@/lib/queries/useDeadlineDashboard'
import type { SemanticColor } from '@/lib/queries/useStageRules'
// Presentation only. Classification and day difference are supplied by PostgreSQL.
export const deadlineLabels: Record<DeadlineStatus,{label:string;color:SemanticColor}> = {
  overdue:{label:'Fuera de plazo',color:'danger'}, today:{label:'Requieren atención hoy',color:'warning'},
  soon:{label:'Próximos a vencer',color:'info'}, within:{label:'Dentro del plazo',color:'success'},
  unconfigured:{label:'Sin plazo registrado',color:'secondary'}, completed:{label:'Sin etapa con plazo activa',color:'secondary'},
}
export function deadlineText(status: DeadlineStatus, days: number | null) {
  if (days === null || status === 'completed' || status === 'unconfigured') return deadlineLabels[status].label
  if (status === 'overdue') return days === 0 ? 'Plazo vencido hoy' : `Vencido hace ${Math.abs(days)} ${Math.abs(days)===1?'día':'días'}`
  return days === 0 ? 'Vence hoy' : days === 1 ? 'Vence mañana' : `Vence en ${days} días`
}
