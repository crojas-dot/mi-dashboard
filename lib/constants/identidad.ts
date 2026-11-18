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
    procesamientoAncho: 2560,
    procesamientoAlto: 1440,
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
// La imagen original se recorta localmente: no se envían decenas de MB a la API.
// El archivo recortado sí debe respetar el límite HTTP y el bucket de Storage.
export const IDENTIDAD_ORIGEN_MAX_BYTES = 30 * 1024 * 1024
export const IDENTIDAD_MAX_BYTES = 4 * 1024 * 1024
export const IDENTIDAD_STORED_BYTES = 2 * 1024 * 1024
export const IDENTIDAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif'
export const IDENTIDAD_ACCEPT_PICKER = 'image/*'

export function esImagenIdentidad(value: unknown): value is ImagenIdentidad {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(IDENTIDAD_IMAGENES, value)
}

/** Devuelve solo una ruta validada dentro del bucket institucional, nunca una URL externa.
 * La URL que se guardó puede proceder de un dominio anterior de Storage.
 * El servidor reconstruye siempre la dirección pública con su cliente Supabase vigente.
 */
export function rutaImagenIdentidad(slot: ImagenIdentidad, value: unknown, origin?: string): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    if (origin && url.origin !== new URL(origin).origin) return null
    const prefix = `/storage/v1/object/public/${LOGO_BUCKET}/identidad/${slot}/`
    if (!url.pathname.startsWith(prefix)) return null
    const name = url.pathname.slice(prefix.length)
    const ext = IDENTIDAD_IMAGENES[slot].formato
    const suffix = `.${ext}`
    if (!name.endsWith(suffix) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name.slice(0, -suffix.length))) return null
    return `identidad/${slot}/${name}`
  } catch { return null }
}

/** Validación estricta cuando se necesita confirmar que una URL ya pertenece al servidor. */
export function urlIdentidadValida(
  slot: ImagenIdentidad,
  value: unknown,
  origin: string | undefined = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined,
): string {
  if (!origin || !rutaImagenIdentidad(slot, value, origin)) return ''
  return value as string
}
