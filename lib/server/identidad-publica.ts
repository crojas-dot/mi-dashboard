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

/** Consulta de identidad al renderizar login. Una misma lectura evita que la marca
 * y el fondo aparezcan después del formulario por consultas cliente independientes.
 */
export async function identidadLoginInicial(): Promise<IdentidadLoginInicial> {
  try {
    const client = createServiceClient()
    if (!client) return {}
    const { data, error } = await client.from('configuraciones_sistema')
      .select('clave,valor')
      .in('clave', [IDENTIDAD_IMAGENES.login_fondo.clave, IDENTIDAD_IMAGENES.login_encabezado.clave])
    if (error) return {}
    const valor = (clave: string) => data?.find(row => row.clave === clave)?.valor
    return {
      fondo: urlPublicaIdentidad(client, 'login_fondo', valor(IDENTIDAD_IMAGENES.login_fondo.clave)),
      logo: urlPublicaIdentidad(client, 'login_encabezado', valor(IDENTIDAD_IMAGENES.login_encabezado.clave)),
    }
  } catch { return {} }
}

/** Compatibilidad con integraciones que solo consultan el fondo. */
export async function fondoLoginInicial() {
  return (await identidadLoginInicial()).fondo ?? ''
}
