/** Centralized status/priority color maps used across quejas pages */

export const prioridadVariant: Record<string, 'red' | 'amber' | 'blue' | 'gray' | 'orange'> = {
  'Baja': 'blue',
  'Media': 'amber',
  'Alta': 'orange',
  'Crítica': 'red',
}

export const estadoVariant: Record<string, 'blue' | 'amber' | 'green' | 'red' | 'gray' | 'purple'> = {
  'Recibido': 'blue',
  'En Investigación': 'amber',
  'Pendiente de Revisión GC': 'purple',
  'Resuelto': 'green',
  'Finalizado': 'gray',
  'No Procede': 'red',
}

export const estadoSACPVariant: Record<string, 'blue' | 'amber' | 'green' | 'red' | 'gray' | 'purple'> = {
  'Abierta': 'blue',
  'En Proceso': 'amber',
  'En Validación': 'purple',
  'Cerrada': 'green',
}

export const estadoDocumentoVariant: Record<string, 'blue' | 'amber' | 'green' | 'red' | 'gray' | 'purple'> = {
  'Borrador': 'amber',
  'En Revisión': 'blue',
  'Publicado': 'green',
  'Archivado': 'gray',
}
