/** Calendario civil del panel. Las fechas SQL sin hora son días, no instantes UTC. */
export const DEFAULT_TIME_ZONE = 'America/Costa_Rica'

export const TIME_ZONE_GROUPS = [
  { label: 'América Central', options: [
    { value: 'America/Costa_Rica', label: 'Costa Rica' },
    { value: 'America/Guatemala', label: 'Guatemala' },
    { value: 'America/El_Salvador', label: 'El Salvador' },
    { value: 'America/Tegucigalpa', label: 'Honduras' },
    { value: 'America/Managua', label: 'Nicaragua' },
    { value: 'America/Belize', label: 'Belice' },
    { value: 'America/Panama', label: 'Panamá' },
  ] },
  { label: 'Otras zonas', options: [
    { value: 'America/Bogota', label: 'Colombia' },
    { value: 'America/Mexico_City', label: 'Ciudad de México' },
    { value: 'America/New_York', label: 'Nueva York' },
    { value: 'Europe/Madrid', label: 'Madrid' },
    { value: 'UTC', label: 'UTC' },
  ] },
] as const

export function zonaHorariaValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || valor.length > 80) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: valor }); return true }
  catch { return false }
}

export function normalizarZonaHoraria(valor: unknown): string {
  return zonaHorariaValida(valor) ? valor : DEFAULT_TIME_ZONE
}

/** Año, mes y día civil del instante en la zona configurada. */
export function partesEnZona(fecha: Date | number | string, zona: string) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(fecha))
  const campo = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value)
  return { anio: campo('year'), mes: campo('month'), dia: campo('day') }
}

export function fechaCivilClave(fecha: Date | number | string, zona: string): string {
  const { anio, mes, dia } = partesEnZona(fecha, zona)
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** DATE de Postgres conserva su día; TIMESTAMPTZ se interpreta en la zona elegida. */
export function mesYAnioEnZona(fecha: string | null | undefined, zona: string) {
  if (!fecha) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { anio: Number(fecha.slice(0, 4)), mes: Number(fecha.slice(5, 7)) }
  }
  const instante = new Date(fecha)
  return Number.isFinite(instante.getTime()) ? partesEnZona(instante, zona) : null
}

/** Meses reales de enero al mes en curso, sin mezclar el año anterior. */
export function mesesDelAnio(ahora: Date | number | string, zona: string) {
  const { anio, mes } = partesEnZona(ahora, zona)
  return {
    anio,
    meses: Array.from({ length: mes }, (_, i) => new Intl.DateTimeFormat('es-CR',
      { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(anio, i, 1)))
      .replace('.', '').replace(/^./, (letra) => letra.toUpperCase())),
  }
}
