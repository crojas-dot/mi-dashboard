import type { Queja } from '@/lib/types'

const ZONA = 'America/Costa_Rica'
const partesFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
})

function diaCivil(value: string | number | Date): number | null {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = Object.fromEntries(partesFecha.formatToParts(date).map(p => [p.type, p.value]))
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000
}

export function fechaIngresoCorta(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const partes = Object.fromEntries(partesFecha.formatToParts(date).map(p => [p.type, p.value]))
  return `${partes.day}/${partes.month}/${partes.year}`
}

export interface SegundaLineaIngreso {
  texto: string
  destacada: boolean
}

/**
 * Es una presentación, no una inferencia desde fecha o revisión.
 * La DB determina si el registro está sin procesar y si sus dos primeros
 * días hábiles siguen vigentes. No inventar actividades ante datos ausentes.
 */
export function detalleFechaIngreso(
  queja: Pick<Queja, 'estado' | 'fecha' | 'ultima_actividad_at' | 'es_nuevo'>,
  ahora: number | Date = Date.now(),
): SegundaLineaIngreso | null {
  if (['Finalizado', 'No Procede'].includes(queja.estado)) return null
  if (queja.es_nuevo === true) return { texto: 'Nuevo', destacada: true }
  if (!queja.ultima_actividad_at) return null
  const hoy = diaCivil(ahora)
  const movimiento = diaCivil(queja.ultima_actividad_at)
  const ingreso = diaCivil(queja.fecha)
  if (hoy === null || movimiento === null || ingreso === null || movimiento < ingreso) return null
  const dias = Math.round(hoy - movimiento)
  if (dias < 0) return null
  if (dias === 0) return { texto: 'Actualización: hoy', destacada: true }
  if (dias === 1) return { texto: 'Actualización: ayer', destacada: false }
  if (dias <= 30) return { texto: `Actualización: hace ${dias} días`, destacada: false }
  return { texto: `Actualización: ${fechaIngresoCorta(queja.ultima_actividad_at)}`, destacada: false }
}

/** El nombre persistido/emitido por catálogo nunca se reescribe. */
export function estadoQuejaEnTabla(estado: string, nombreVisible?: string | null): string {
  return estado === 'Pendiente de Revisión GC' ? 'Revisión GC' : nombreVisible || estado
}
