const fechaIngreso = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric',
})

/** La recepción es un instante; su día visible pertenece siempre a Costa Rica. */
export function formatFechaIngreso(fecha: string): string {
  return Number.isFinite(Date.parse(fecha)) ? fechaIngreso.format(new Date(fecha)) : '—'
}

/** Solo la tabla abrevia la etiqueta; filtros, catálogos e IDs conservan su contrato. */
export function estadoQuejaEnTabla(queja: { estado: string; estado_nombre?: string }): string {
  return queja.estado === 'Pendiente de Revisión GC' ? 'Revisión GC' : queja.estado_nombre || queja.estado
}
