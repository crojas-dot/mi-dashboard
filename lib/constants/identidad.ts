import { LOGO_BUCKET } from '@/lib/constants/marca'

/** Recursos institucionales públicos. La foto personal utiliza otro bucket privado. */
export const IDENTIDAD_IMAGENES = {
  correo_encabezado: {
    clave: 'org.identidad.correo_encabezado',
    titulo: 'Encabezado de los correos',
    descripcion: 'Imagen horizontal para la cabecera de las comunicaciones por correo.',
    proporcion: 3,
    ancho: 1200,
    alto: 400,
  },
  correo_pie: {
    clave: 'org.identidad.correo_pie',
    titulo: 'Pie de los correos',
    descripcion: 'Imagen opcional para la firma visual al final del mensaje.',
    proporcion: 3,
    ancho: 1200,
    alto: 400,
  },
  login_fondo: {
    clave: 'org.identidad.login_fondo',
    titulo: 'Fondo del inicio de sesión',
    descripcion: 'Imagen de fondo de la pantalla donde los usuarios ingresan al sistema.',
    proporcion: 16 / 9,
    ancho: 1600,
    alto: 900,
  },
  formulario_fondo: {
    clave: 'org.identidad.formulario_fondo',
    titulo: 'Fondo del formulario externo',
    descripcion: 'Fondo de los formularios públicos y su pantalla de confirmación.',
    proporcion: 16 / 9,
    ancho: 1600,
    alto: 900,
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
export function urlIdentidadValida(slot: ImagenIdentidad, value: unknown, origin: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  if (typeof value !== 'string' || !origin) return ''
  try {
    const expected = new URL(origin)
    const url = new URL(value)
    const prefix = `/storage/v1/object/public/${LOGO_BUCKET}/identidad/${slot}/`
    const name = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : ''
    if (expected.protocol !== 'https:' || url.origin !== expected.origin || url.search || url.hash
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(name)) return ''
    return url.toString()
  } catch { return '' }
}

export function rutaImagenIdentidad(slot: ImagenIdentidad, url: unknown, origin?: string) {
  const safe = urlIdentidadValida(slot, url, origin)
  return safe ? `identidad/${slot}/${safe.split('/').at(-1)}` : null
}
