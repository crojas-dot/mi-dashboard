export const NOTA_DEVOLUCION_PREFIX = 'Devuelta a investigación. Motivo: '

// Estos mensajes son del workflow, aunque su tipo histórico sea «nota».
export function esNotaInvestigacion(item: { tipo: string; descripcion: string }) {
  return item.tipo === 'nota'
    && !item.descripcion.startsWith(NOTA_DEVOLUCION_PREFIX)
    && item.descripcion !== 'Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.'
    && item.descripcion !== 'Respuesta al cliente y oficio oficial publicados. Expediente finalizado.'
}
