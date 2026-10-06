import { DEFAULT_TIME_ZONE, fechaCivilClave } from '@/lib/timeZone'

/** Una fecha sin hora representa todo el día civil de la zona elegida. */
export function estadoPlazo(fecha: string | null | undefined, ahora: number, zona = DEFAULT_TIME_ZONE): 'Vencido' | 'Vence hoy' | 'Por vencer' | 'Sin fecha' {
  if (!fecha) return 'Sin fecha'
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  const hoy = fechaCivilClave(ahora, zona)
  if (soloFecha) return fecha < hoy ? 'Vencido' : fecha === hoy ? 'Vence hoy' : 'Por vencer'
  const limite = new Date(fecha)
  if (!Number.isFinite(limite.getTime())) return 'Sin fecha'
  if (limite.getTime() < ahora) return 'Vencido'
  return fechaCivilClave(limite, zona) === hoy ? 'Vence hoy' : 'Por vencer'
}

export const COLORES_PLAZO = { Vencido: 'danger', 'Vence hoy': 'warning', 'Por vencer': 'info', 'Sin fecha': 'secondary' } as const

/** Evita que una fecha SQL sin hora aparezca como el día anterior en Costa Rica. */
export function formatoFechaPlazo(fecha: string | null | undefined, zona = DEFAULT_TIME_ZONE): string {
  if (!fecha) return 'Sin fecha'
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  const limite = new Date(soloFecha ? `${fecha}T12:00:00Z` : fecha)
  return Number.isFinite(limite.getTime())
    ? new Intl.DateTimeFormat('es-CR', { timeZone: soloFecha ? 'UTC' : zona, day: 'numeric', month: 'short', year: 'numeric' }).format(limite)
    : 'Sin fecha'
}

export function contarPlazos<T>(filas: T[], fecha: (fila: T) => string | null | undefined, ahora: number, zona = DEFAULT_TIME_ZONE) {
  const conteos = { Vencido: 0, 'Vence hoy': 0, 'Por vencer': 0, 'Sin fecha': 0 }
  for (const fila of filas) conteos[estadoPlazo(fecha(fila), ahora, zona)] += 1
  return Object.entries(conteos).map(([etiqueta, total]) => ({
    etiqueta, total, color: COLORES_PLAZO[etiqueta as keyof typeof COLORES_PLAZO],
  }))
}
