import 'server-only'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { LOGO_BUCKET } from '@/lib/constants/marca'
import { IDENTIDAD_IMAGENES, rutaImagenIdentidad, type ImagenIdentidad } from '@/lib/constants/identidad'

type Cliente = NonNullable<ReturnType<typeof createServiceClient>>

/** El frontend recibe siempre la URL generada por nuestro propio Supabase,
 * nunca la URL sin comprobar guardada en una fila.
 */
export function urlPublicaIdentidad(client: Cliente, slot: ImagenIdentidad, valor: unknown): string {
  const ruta = rutaImagenIdentidad(slot, valor)
  if (!ruta) return ''
  const url = client.storage.from(LOGO_BUCKET).getPublicUrl(ruta).data.publicUrl
  return rutaImagenIdentidad(slot, url) ? url : ''
}

/** El fondo del login se obtiene en el servidor para que aparezca en el primer render,
 * en lugar de esperar a la consulta React Query cuando la pantalla ya está visible.
 * Nunca impide iniciar sesión si Supabase no responde.
 */
export async function fondoLoginInicial(): Promise<string> {
  try {
    const client = createServiceClient()
    if (!client) return ''
    const { data, error } = await client.from('configuraciones_sistema')
      .select('valor').eq('clave', IDENTIDAD_IMAGENES.login_fondo.clave).maybeSingle()
    return error ? '' : urlPublicaIdentidad(client, 'login_fondo', data?.valor)
  } catch { return '' }
}
