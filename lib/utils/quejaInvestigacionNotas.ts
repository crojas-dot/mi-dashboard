export const NOTA_DEVOLUCION_PREFIX = 'Devuelta a investigación. Motivo: '
export const NOTA_APROBACION_GC = 'Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.'

// Estos mensajes son del workflow, aunque su tipo histórico sea «nota».
export function esNotaInvestigacion(item: { tipo: string; descripcion: string }) {
  return item.tipo === 'nota'
    && !item.descripcion.startsWith(NOTA_DEVOLUCION_PREFIX)
    && item.descripcion !== NOTA_APROBACION_GC
    && item.descripcion !== 'Respuesta al cliente y oficio oficial publicados. Expediente finalizado.'
}

/**
 * Solo una devolución que sea la última decisión de GC, mientras el expediente
 * está en investigación, permite mostrar el motivo y el botón de reenvío.
 * Las devoluciones anteriores se conservan en el historial, no en Acción actual.
 */
export function obtenerDevolucionPendiente(
  estado: string,
  actividad: readonly { tipo: string; descripcion: string; created_at: string }[],
): { motivo: string; fecha: string } | undefined {
  if (estado !== 'En Investigación') return undefined
  const ultimaDecision = [...actividad].reverse().find(item =>
    item.tipo === 'nota' && (item.descripcion.startsWith(NOTA_DEVOLUCION_PREFIX) || item.descripcion === NOTA_APROBACION_GC)
  )
  if (!ultimaDecision?.descripcion.startsWith(NOTA_DEVOLUCION_PREFIX)) return undefined
  return {
    motivo: ultimaDecision.descripcion.slice(NOTA_DEVOLUCION_PREFIX.length).trim(),
    fecha: ultimaDecision.created_at,
  }
}
