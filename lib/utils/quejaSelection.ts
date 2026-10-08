import type { Queja } from '@/lib/types'

// Ejecutar dentro de la actualización funcional: la selección puede cambiar antes del commit.
export function updateSelectedQueja(current: Queja | null, updated: Queja, isCurrent?: () => boolean): Queja | null {
  if (isCurrent?.() === false || current?.id !== updated.id || current.revision > updated.revision) return current
  return updated
}
