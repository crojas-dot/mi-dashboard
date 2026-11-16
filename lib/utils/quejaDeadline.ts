export interface QuejaConPlazo {
  estado: string
  fecha_sla?: string | null
  fecha_limite_investigacion?: string | null
  plazo_vence?: string | null
  plazo_etapa?: string | null
  plazo_situacion?: string | null
  plazo_dias?: number | null
  bandeja_plazo_vence?: string | null
}

export interface QuejaDeadline {
  vence: string | null
  etapa: string | null
  label: string
  variant: 'gray' | 'green' | 'amber' | 'red'
  vencido: boolean
}

const estadosTerminados = new Set(['Resuelto', 'Finalizado', 'No Procede', 'Cerrado', 'Cerrada'])
const dateFormatter = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric',
})
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric',
})

/** El plazo se calcula en PostgreSQL con su calendario/version; aquí solo se presenta. */
export function getQuejaDeadlineDate(queja: QuejaConPlazo): string | null {
  if (estadosTerminados.has(queja.estado)) return null
  const fallback = queja.estado === 'Recibido'
    ? queja.fecha_sla
    : ['En Investigación', 'Pendiente de Revisión GC'].includes(queja.estado)
      ? queja.fecha_limite_investigacion
      : null
  // El null explícito de la vista significa que no hay ejecución vigente.
  const vence = queja.bandeja_plazo_vence !== undefined ? queja.bandeja_plazo_vence
    : queja.plazo_vence !== undefined ? queja.plazo_vence : fallback
  return vence && Number.isFinite(Date.parse(vence)) ? vence : null
}

export function getQuejaDeadline(queja: QuejaConPlazo, now: number | Date = Date.now()): QuejaDeadline {
  if (estadosTerminados.has(queja.estado))
    return { vence: null, etapa: null, label: 'Completado', variant: 'gray', vencido: false }
  const vence = getQuejaDeadlineDate(queja)
  const etapa = queja.plazo_etapa ?? (queja.estado === 'Recibido' ? 'quejas.evaluation' : 'quejas.investigation')
  if (!vence) return { vence: null, etapa: null, label: 'Sin plazo', variant: 'gray', vencido: false }
  const time = now instanceof Date ? now.getTime() : now
  const dueDate = new Date(vence)
  // Días naturales hasta la fecha local persistida; no recalcular el plazo hábil de DB.
  const civilDay = (value: number | Date) => {
    const parts = Object.fromEntries(dayFormatter.formatToParts(value).map(p => [p.type, p.value]))
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000
  }
  const remaining = Math.round(civilDay(dueDate) - civilDay(time))
  // Se compara la fecha civil de Costa Rica, no la hora: hoy nunca es Vencido.
  if (remaining < 0) return { vence, etapa, label: 'Vencido', variant: 'red', vencido: true }
  if (remaining === 0) return { vence, etapa, label: 'Vence hoy', variant: 'red', vencido: false }
  if (remaining === 1) return { vence, etapa, label: 'Vence mañana', variant: 'green', vencido: false }
  return { vence, etapa, label: `Vence en ${remaining} días`, variant: 'green', vencido: false }
}

/** Los timestamps se muestran siempre en la zona de los plazos, no en la del dispositivo. */
export function formatQuejaDeadlineDate(vence?: string | null): string {
  return vence && Number.isFinite(Date.parse(vence)) ? dateFormatter.format(new Date(vence)) : '—'
}
