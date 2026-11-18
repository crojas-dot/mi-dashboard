import { LOGO_BUCKET } from '@/lib/constants/marca'

/** Recursos institucionales públicos. La foto personal utiliza otro bucket privado. */
export const IDENTIDAD_IMAGENES = {
  correo_encabezado: {
    clave: 'org.identidad.correo_encabezado',
    titulo: 'Logo del encabezado de correos',
    descripcion: 'Reemplaza el cuadro azul con la E, junto a «QMS ECA». No es un banner.',
    proporcion: 1,
    ancho: 512,
    alto: 512,
    formato: 'png',
    recomendacion: 'Imagen cuadrada de 512 × 512 px. Preferí PNG con fondo transparente y bordes nítidos; idealmente menos de 300 KB.',
  },
  login_fondo: {
    clave: 'org.identidad.login_fondo',
    titulo: 'Fondo del inicio de sesión',
    descripcion: 'Imagen de fondo de la pantalla donde los usuarios ingresan al sistema.',
    proporcion: 16 / 9,
    ancho: 1600,
    alto: 900,
    formato: 'webp',
    recomendacion: 'Imagen horizontal de 1600 × 900 px (16:9). Preferí JPG o WebP de buena calidad, sin texto importante; idealmente entre 300 KB y 1 MB.',
  },
  formulario_encabezado: {
    clave: 'org.identidad.formulario_encabezado',
    titulo: 'Logo del formulario externo',
    descripcion: 'Se muestra en la esquina superior derecha del encabezado, sin cubrir los campos.',
    proporcion: 3,
    ancho: 900,
    alto: 300,
    formato: 'webp',
    recomendacion: 'Logo horizontal de 900 × 300 px (3:1). Preferí PNG transparente o WebP de alta calidad; idealmente menos de 400 KB.',
  },
} as const

export type ImagenIdentidad = keyof typeof IDENTIDAD_IMAGENES
export const IDENTIDAD_SLOTS = Object.keys(IDENTIDAD_IMAGENES) as ImagenIdentidad[]
export const IDENTIDAD_MAX_BYTES = 4 * 1024 * 1024
export const IDENTIDAD_STORED_BYTES = 2 * 1024 * 1024
export const IDENTIDAD_ACCEPT = 'image/png,image/jpeg,image/webp'

export function esImagenIdentidad(value: unknown): value is ImagenIdentidad {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(IDENTIDAD_IMAGENES, value)
}

/** Nunca renderizar una URL externa o una ruta ajena al slot en un fondo o correo. */
export function urlIdentidadValida(slot: ImagenIdentidad, value: unknown, origin: string | undefined = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined): string {
  if (typeof value !== 'string' || !origin) return ''
  try {
    const expected = new URL(origin)
    const url = new URL(value)
    const prefix = `/storage/v1/object/public/${LOGO_BUCKET}/identidad/${slot}/`
    const name = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : ''
    const ext = IDENTIDAD_IMAGENES[slot].formato
    const suffix = `.${ext}`
    if (expected.protocol !== 'https:' || url.origin !== expected.origin || url.search || url.hash
      || !name.endsWith(suffix)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name.slice(0, -suffix.length))) return ''
    return url.toString()
  } catch { return '' }
}

export function rutaImagenIdentidad(slot: ImagenIdentidad, url: unknown, origin?: string) {
  const safe = urlIdentidadValida(slot, url, origin)
  return safe ? `identidad/${slot}/${safe.split('/').at(-1)}` : null
}
