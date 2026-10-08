/**
 * Identidad y presentación de los módulos. No concede permisos ni reemplaza API/RLS.
 * Sin React, red o secretos: este registro se comparte entre cliente y servidor.
 */
export const MODULOS = {
  dashboard: { ruta: '/', label: 'Dashboard', iconKey: 'chartPie' },
  quejas: { ruta: '/quejas', label: 'Quejas', iconKey: 'messageSquareText' },
  mis_quejas: { ruta: '/mis-quejas', label: 'Mis Quejas', iconKey: 'inbox' },
  documentos: { ruta: '/documentos', label: 'Documentos', iconKey: 'folderOpen' },
  sacp: { ruta: '/sacp', label: 'SACP', iconKey: 'listChecks' },
  riesgos: { ruta: '/riesgos', label: 'Riesgos', iconKey: 'shieldAlert' },
  auditorias: { ruta: '/auditorias', label: 'Auditorías', iconKey: 'clipboardCheck' },
  revision: { ruta: '/revision', label: 'Revisión por Dirección', iconKey: 'presentation' },
  procesos: { ruta: '/procesos', label: 'Procesos', iconKey: 'workflow' },
  usuarios: { ruta: '/usuarios', label: 'Usuarios', iconKey: 'usersRound' },
  configuracion: { ruta: '/configuracion', label: 'Configuración', iconKey: 'settings2' },
  reporteria: { ruta: '/reporteria', label: 'Reportería', iconKey: 'chartNoAxesCombined' },
} as const

export type ModuloId = keyof typeof MODULOS
export type ModuloIconKey = (typeof MODULOS)[ModuloId]['iconKey']

// El menú y la matriz conservan sus órdenes actuales, que no son idénticos.
export const GRUPOS_NAVEGACION = [
  { label: 'Gestión', modulos: ['dashboard', 'quejas', 'mis_quejas', 'documentos', 'sacp'] },
  { label: 'Seguimiento', modulos: ['riesgos', 'auditorias', 'revision', 'procesos'] },
  { label: 'Administración', modulos: ['usuarios', 'reporteria', 'configuracion'] },
] as const satisfies readonly { label: string; modulos: readonly ModuloId[] }[]

export const MODULOS_PERMISOS = (Object.keys(MODULOS) as ModuloId[])
  .map(key => ({ key, label: MODULOS[key].label }))

export const MODULOS_DE_RUTA: Record<string, ModuloId> = Object.fromEntries(
  Object.entries(MODULOS).map(([id, modulo]) => [modulo.ruta.slice(1), id as ModuloId]),
)

const TITULOS_DE_RUTA: Record<string, string> = Object.fromEntries(
  Object.values(MODULOS).map(modulo => [modulo.ruta, modulo.label]),
)

/** El encabezado conserva coincidencia exacta; los guards usan el primer segmento. */
export function tituloDeRuta(pathname: string): string {
  return TITULOS_DE_RUTA[pathname] || 'QMS'
}

// IA tiene un alcance propio: no habilitar un módulo nuevo por aparecer en el menú.
const MODULOS_IA_QMS = ['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'revision'] as const satisfies readonly ModuloId[]
export type ModuloIAId = (typeof MODULOS_IA_QMS)[number] | 'general'
const ETIQUETAS_IA: Partial<Record<ModuloId, string>> = {
  sacp: 'SACP (Acciones)',
  revision: 'Revisión Dirección',
}
export const MODULOS_IA: { id: ModuloIAId; label: string }[] = [
  ...MODULOS_IA_QMS.map(id => ({ id, label: ETIQUETAS_IA[id] ?? MODULOS[id].label })),
  { id: 'general', label: 'General' },
]
const IDS_IA = new Set<string>(MODULOS_IA.map(modulo => modulo.id))
export function esModuloIA(value: unknown): value is ModuloIAId {
  return typeof value === 'string' && IDS_IA.has(value)
}
