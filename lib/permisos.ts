export interface Permiso {
  rol: string
  modulo: string
  leer: boolean
  escribir: boolean
}

export const MODULOS_DE_RUTA: Record<string, string> = {
  '': 'dashboard',
  'mis-quejas': 'mis_quejas',
  quejas: 'quejas',
  documentos: 'documentos',
  sacp: 'sacp',
  riesgos: 'riesgos',
  auditorias: 'auditorias',
  revision: 'revision',
  procesos: 'procesos',
  usuarios: 'usuarios',
  configuracion: 'configuracion',
  reporteria: 'reporteria',
}

export function moduloDeRuta(pathname: string): string {
  const seg = pathname.split('/')[1] ?? ''
  return MODULOS_DE_RUTA[seg] ?? ''
}

export function tienePermiso(
  permisos: Permiso[],
  modulo: string,
  requiereEscribir = false,
  realRol?: string,
): boolean {
  if (realRol === 'admin' && modulo === 'configuracion') return true
  const p = permisos.find((x) => x.modulo === modulo)
  if (!p || !p.leer) return false
  if (requiereEscribir) return p.escribir
  return true
}