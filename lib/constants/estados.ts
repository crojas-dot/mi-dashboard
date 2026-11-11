import type { VarianteBadge } from './badges'
import { ESTADOS_QUEJA } from './quejas'
import type { ModuloId } from './modulos'

/** Variantes de presentación; los códigos y transiciones permanecen en quejas.ts. */
export const prioridadVariant: Readonly<Record<string, VarianteBadge>> = {
  Baja: 'blue', Media: 'amber', Alta: 'orange', Crítica: 'red',
}
export const estadoVariant: Readonly<Record<string, VarianteBadge>> = Object.fromEntries(
  Object.entries(ESTADOS_QUEJA).map(([estado, config]) => [estado, config.variante]),
)
export const estadoSACPVariant: Readonly<Record<string, VarianteBadge>> = {
  Abierta: 'neutral', 'En Proceso': 'neutral', 'En Validación': 'neutral', Cerrada: 'neutral',
}
export const estadoDocumentoVariant: Readonly<Record<string, VarianteBadge>> = {
  Borrador: 'neutral', 'En Revisión': 'neutral', Publicado: 'neutral', Archivado: 'neutral',
}
export const estadoAuditoriaVariant: Readonly<Record<string, VarianteBadge>> = {
  Planificada: 'neutral', 'En Curso': 'neutral', Completada: 'neutral',
}
export const estadoRevisionVariant: Readonly<Record<string, VarianteBadge>> = {
  Planificada: 'neutral', Realizada: 'neutral', Cancelada: 'neutral',
}
export const nivelRiesgoVariant: Readonly<Record<string, VarianteBadge>> = {
  Bajo: 'green', Medio: 'amber', Alto: 'red', Critico: 'red',
}
const porModulo: Partial<Record<ModuloId, Readonly<Record<string, VarianteBadge>>>> = {
  quejas: estadoVariant, mis_quejas: estadoVariant, sacp: estadoSACPVariant,
  documentos: estadoDocumentoVariant, auditorias: estadoAuditoriaVariant, revision: estadoRevisionVariant,
}
export function varianteEstado(modulo: ModuloId, estado: string): VarianteBadge {
  const mapa = porModulo[modulo]
  return mapa && Object.hasOwn(mapa, estado) ? mapa[estado] : 'neutral'
}
