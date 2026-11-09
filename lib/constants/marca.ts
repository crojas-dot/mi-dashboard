/**
 * Contrato del logo institucional que se muestra en el menú lateral.
 * Lo comparten el endpoint /api/configuracion/logo (servidor), el hook de
 * lectura y el editor de recorte: bucket, clave y límites no se repiten por capa.
 */

/** Bucket público de Supabase Storage; el logo no es información sensible. */
export const LOGO_BUCKET = 'branding'
/** Clave en configuraciones_sistema. Guarda la URL pública del objeto vigente. */
export const LOGO_CLAVE = 'org.logo_url'
/** Solo imágenes raster: un SVG podría traer scripts si se sirviera como documento. */
export const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const
export type LogoMime = (typeof LOGO_MIME)[number]
/** Máximo del archivo que se sube a Storage (el bucket aplica el mismo tope). */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024
/** Lado del cuadrado que se guarda: el recorte se resuelve en el cliente. */
export const LOGO_LADO = 512
/** Máximo de la imagen original que el administrador puede elegir antes de recortar. */
export const LOGO_ORIGEN_MAX_BYTES = 8 * 1024 * 1024

export function esLogoTipo(tipo: string): tipo is LogoMime {
  return (LOGO_MIME as readonly string[]).includes(tipo)
}

export function logoExtension(tipo: LogoMime): string {
  return tipo === 'image/png' ? 'png' : tipo === 'image/jpeg' ? 'jpg' : 'webp'
}

/** La clave guarda una URL pública del bucket; cualquier otro valor equivale a «sin logo». */
export function urlLogoValida(valor: unknown): string {
  return typeof valor === 'string' && /^https?:\/\//.test(valor) ? valor : ''
}
