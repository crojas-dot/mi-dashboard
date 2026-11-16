const fechaIngreso = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric',
})

/** La recepción es un instante; su día visible pertenece siempre a Costa Rica. */
export function formatFechaIngreso(fecha: string): string {
  return Number.isFinite(Date.parse(fecha)) ? fechaIngreso.format(new Date(fecha)) : '—'
}
