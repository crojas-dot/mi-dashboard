/** Centralized status/priority color maps used across quejas pages */

export const prioridadVariant: Record<string, 'red' | 'yellow' | 'blue' | 'gray'> = {
  'Alta': 'red',
  'Media': 'yellow',
  'Baja': 'blue',
}

export const estadoVariant: Record<string, 'blue' | 'yellow' | 'green' | 'red' | 'gray' | 'purple'> = {
  'Recibido': 'blue',
  'En Investigación': 'yellow',
  'Pendiente de Revisión GC': 'purple',
  'Resuelto': 'green',
  'Finalizado': 'gray',
  'No Procede': 'red',
}

export const estadoSACPVariant: Record<string, 'blue' | 'yellow' | 'green' | 'red' | 'gray' | 'purple'> = {
  'Abierta': 'blue',
  'En Proceso': 'yellow',
  'En Validación': 'purple',
  'Cerrada': 'green',
}

export const estadoDocumentoVariant: Record<string, 'blue' | 'yellow' | 'green' | 'red' | 'gray' | 'purple'> = {
  'Borrador': 'yellow',
  'En Revisión': 'blue',
  'Publicado': 'green',
  'Archivado': 'gray',
}
