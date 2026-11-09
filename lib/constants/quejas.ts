// categoria conserva el nombre del contrato de alta; tipo es su lectura automática.
// El catálogo de cliente ya no ofrece 'Denuncia'; las listas válidas DB aplicadas
// siguen aceptándola como valor histórico y no se editan para simular su retiro.
export const TIPOS_REGISTRO_QUEJA = [
  'Queja', 'Observación', 'Sugerencia', 'Reclamo', 'Felicitación',
] as const

export const REGISTRO_QUEJA_LIMITES = { area: 150, oficio: 120, observaciones: 10_000 } as const

// El código se envía al workflow; la variante pinta la UI y no concede autorización.
export const ESTADOS_QUEJA = {
  Recibido: { codigo: 'received', variante: 'blue' },
  'En Investigación': { codigo: 'investigation', variante: 'investigacion' },
  'Pendiente de Revisión GC': { codigo: 'quality_review', variante: 'purple' },
  Resuelto: { codigo: 'resolved', variante: 'green' },
  Finalizado: { codigo: 'finished', variante: 'gray' },
  'No Procede': { codigo: 'rejected', variante: 'red' },
} as const
export const CODIGOS_ESTADO_QUEJA: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ESTADOS_QUEJA).map(([estado, config]) => [estado, config.codigo]),
)
/** Los filtros envían IDs históricos; la etiqueta y el color pueden configurarse. */
export function opcionesEstadoQueja(catalogo: readonly { valor: string; color?: string; codigo?: string; valor_interno?: string }[]) {
  return Object.entries(ESTADOS_QUEJA).map(([valor, config]) => {
    const row = catalogo.find(item => item.codigo === config.codigo || item.valor_interno === valor)
    return { valor, etiqueta: row?.valor ?? valor, color: row?.color ?? config.variante }
  })
}
/** Regla del indicador SLA legacy: cambiar un color nunca cambia la resolución. */
export function esQuejaResuelta(estado: string): boolean { return estado === 'Resuelto' }

export function tipoVisible(queja: { tipo?: string | null; categoria?: string | null }): string {
  return queja.tipo || queja.categoria || '—'
}

// Las columnas DATE de Postgres ya tienen día local; new Date('AAAA-MM-DD')
// las interpretaría como UTC y podría mostrar el día anterior en Costa Rica.
export function fechaLocalVisible(fecha?: string | null): string {
  if (!fecha) return '—'
  const partes = fecha.split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha
}
