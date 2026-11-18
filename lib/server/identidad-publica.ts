import 'server-only'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { LOGO_BUCKET, LOGO_CLAVE } from '@/lib/constants/marca'
import { IDENTIDAD_IMAGENES, rutaImagenIdentidad, type ImagenIdentidad } from '@/lib/constants/identidad'

type Cliente = NonNullable<ReturnType<typeof createServiceClient>>

/** Jamás renderizar una URL de terceros almacenada en configuraciones_sistema. */
export function urlPublicaIdentidad(client: Cliente, slot: ImagenIdentidad, valor: unknown): string {
  const ruta = rutaImagenIdentidad(slot, valor)
  if (!ruta) return ''
  const url = client.storage.from(LOGO_BUCKET).getPublicUrl(ruta).data.publicUrl
  return rutaImagenIdentidad(slot, url) ? url : ''
}

/** El mismo logo del menú, en una URL pública canónica para la pantalla sin sesión. */
export function urlPublicaLogoLogin(client: Cliente, valor: unknown): string {
  if (typeof valor !== 'string') return ''
  try {
    const url = new URL(valor)
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!origin || url.origin !== new URL(origin).origin ||
        url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) return ''
    const prefix = `/storage/v1/object/public/${LOGO_BUCKET}/`
    if (!url.pathname.startsWith(prefix)) return ''
    const file = url.pathname.slice(prefix.length)
    if (!/^logo-[0-9]+\.(?:png|jpg|jpeg|webp)$/i.test(file)) return ''
    return client.storage.from(LOGO_BUCKET).getPublicUrl(file).data.publicUrl
  } catch { return '' }
}

export interface IdentidadLoginInicial { fondo: string; logo: string }

/** Consulta de identidad al renderizar login. Una misma lectura evita que la marca
 * y el fondo aparezcan después del formulario por consultas cliente independientes.
 */
export async function identidadLoginInicial(): Promise<IdentidadLoginInicial> {
  const vacio = { fondo: '', logo: '' }
  try {
    const client = createServiceClient()
    if (!client) return vacio
    const { data, error } = await client.from('configuraciones_sistema')
      .select('clave,valor')
      .in('clave', [IDENTIDAD_IMAGENES.login_fondo.clave, LOGO_CLAVE])
    if (error) return vacio
    const valor = (clave: string) => data?.find(row => row.clave === clave)?.valor
    return {
      fondo: urlPublicaIdentidad(client, 'login_fondo', valor(IDENTIDAD_IMAGENES.login_fondo.clave)),
      logo: urlPublicaLogoLogin(client, valor(LOGO_CLAVE)),
    }
  } catch { return vacio }
}

/** Compatibilidad con integraciones que solo consultan el fondo. */
export async function fondoLoginInicial() {
  return (await identidadLoginInicial()).fondo
}
