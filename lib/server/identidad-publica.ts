import 'server-only'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { LOGO_BUCKET } from '@/lib/constants/marca'
import { IDENTIDAD_IMAGENES, rutaImagenIdentidad, type ImagenIdentidad } from '@/lib/constants/identidad'

type Cliente = NonNullable<ReturnType<typeof createServiceClient>>

/** Jamás renderizar una URL de terceros almacenada en configuraciones_sistema. */
export function urlPublicaIdentidad(client: Cliente, slot: ImagenIdentidad, valor: unknown): string {
  const ruta = rutaImagenIdentidad(slot, valor)
  if (!ruta) return ''
  const url = client.storage.from(LOGO_BUCKET).getPublicUrl(ruta).data.publicUrl
  return rutaImagenIdentidad(slot, url) ? url : ''
}

// Ausente equivale a lectura fallida. Vacío equivale a un recurso sin configurar.
export interface IdentidadLoginInicial { fondo?: string; logo?: string }

async function leerIdentidadPublica<Slot extends ImagenIdentidad>(slots: Slot[]): Promise<Partial<Record<Slot, string>>> {
  try {
    const client = createServiceClient()
    if (!client) return {}
    const { data, error } = await client.from('configuraciones_sistema')
      .select('clave,valor').in('clave', slots.map(slot => IDENTIDAD_IMAGENES[slot].clave))
    if (error) return {}
    return Object.fromEntries(slots.map(slot => [slot, urlPublicaIdentidad(client, slot,
      data?.find(row => row.clave === IDENTIDAD_IMAGENES[slot].clave)?.valor)])) as Record<Slot, string>
  } catch { return {} }
}

/** Consulta de identidad al renderizar login. Una misma lectura evita que la marca
 * y el fondo aparezcan después del formulario por consultas cliente independientes.
 */
export async function identidadLoginInicial(): Promise<IdentidadLoginInicial> {
  const identidad = await leerIdentidadPublica(['login_fondo', 'login_encabezado'])
  if (identidad.login_fondo === undefined) return {}
  return { fondo: identidad.login_fondo, logo: identidad.login_encabezado }
}

export function identidadFormularioInicial(isEmbed: boolean) {
  return leerIdentidadPublica<'login_fondo' | 'formulario_encabezado'>(isEmbed
    ? ['formulario_encabezado'] : ['login_fondo', 'formulario_encabezado'])
}
