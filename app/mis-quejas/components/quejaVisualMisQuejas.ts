import type { Queja } from '@/lib/types'

/** Proyección de solo lectura del ciclo para el encargado; nunca cambia ni guarda el estado real. */
export function estadoVisualMisQuejas(estado: Queja['estado']): Queja['estado'] {
  if (estado === 'Resuelto' || estado === 'Finalizado') return 'Pendiente de Revisión GC'
  if (estado === 'No Procede') return 'Recibido'
  return estado
}

export function quejaVisualMisQuejas(queja: Queja): Queja {
  const visual = estadoVisualMisQuejas(queja.estado)
  return visual === queja.estado ? queja : { ...queja, estado: visual }
}
