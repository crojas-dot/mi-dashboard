import { MOTIVOS_AGENDA, type AgendaHoyItem, type MotivoAgenda } from '@/lib/constants/agenda'

/** Un punto por fecha real; conserva el motivo de mayor prioridad. */
export function puntosAgenda(items: readonly AgendaHoyItem[]) {
  const puntos = new Map<string, MotivoAgenda>()
  for (const item of items) {
    if (!item.fecha_limite) continue
    const previo = puntos.get(item.fecha_limite)
    if (!previo || MOTIVOS_AGENDA[item.motivo].orden < MOTIVOS_AGENDA[previo].orden) puntos.set(item.fecha_limite, item.motivo)
  }
  return puntos
}

/** Proyección visual del mes civil de Costa Rica; no calcula plazos de negocio. */
export function crearMesAgenda(fecha = new Date(), offsetMes = 0) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Costa_Rica', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(fecha)
  const valor = (tipo: string) => Number(partes.find(parte => parte.type === tipo)?.value)
  const anio = valor('year'), mes = valor('month'), hoy = valor('day')
  const inicio = new Date(Date.UTC(anio, mes - 1 + offsetMes, 1))
  const anioVisible = inicio.getUTCFullYear(), mesVisible = inicio.getUTCMonth() + 1
  const desplazamiento = inicio.getUTCDay()
  const dias = new Date(Date.UTC(anioVisible, mesVisible, 0)).getUTCDate()
  const titulo = new Intl.DateTimeFormat('es-CR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(inicio)
  const totalSemanas = Math.ceil((desplazamiento + dias) / 7)
  const celdas = Array.from({ length: totalSemanas * 7 }, (_, indice) => {
    const dia = indice - desplazamiento + 1
    return dia > 0 && dia <= dias ? dia : null
  })
  const prefijo = `${anioVisible}-${String(mesVisible).padStart(2, '0')}-`
  const fechaHoy = `${anio}-${String(mes).padStart(2, '0')}-${String(hoy).padStart(2, '0')}`
  return { titulo, hoy: anio === anioVisible && mes === mesVisible ? hoy : null, fechaHoy, prefijo,
    semanas: Array.from({ length: totalSemanas }, (_, indice) => celdas.slice(indice * 7, indice * 7 + 7)) }
}
