import type { VarianteBadge } from './badges'
import { ESTADOS_QUEJA } from './quejas'
import type { ModuloId } from './modulos'

/** Mapas de presentación por módulo. Conservar nombres/códigos persistidos del workflow. */
export const prioridadVariant: Readonly<Record<string, VarianteBadge>> = {
  Baja: 'blue', Media: 'amber', Alta: 'orange', Crítica: 'red',
}
export const estadoVariant: Readonly<Record<string, VarianteBadge>> = Object.fromEntries(
  Object.entries(ESTADOS_QUEJA).map(([estado, config]) => [estado, config.variante]),
)
export const estadoSACPVariant: Readonly<Record<string, VarianteBadge>> = {
  Abierta: 'red', 'En Proceso': 'blue', 'En Validación': 'amber', Cerrada: 'green',
}
export const estadoDocumentoVariant: Readonly<Record<string, VarianteBadge>> = {
  Borrador: 'gray', 'En Revisión': 'amber', Publicado: 'green', Archivado: 'red',
}
export const estadoAuditoriaVariant: Readonly<Record<string, VarianteBadge>> = {
  Planificada: 'blue', 'En Curso': 'amber', Completada: 'green',
}
export const estadoRevisionVariant: Readonly<Record<string, VarianteBadge>> = {
  Planificada: 'blue', Realizada: 'green', Cancelada: 'red',
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
  return mapa && Object.hasOwn(mapa, estado) ? mapa[estado] : 'gray'
}
