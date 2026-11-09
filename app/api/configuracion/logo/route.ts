import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { LOGO_BUCKET, LOGO_CLAVE, LOGO_MAX_BYTES, esLogoTipo, logoExtension, urlLogoValida } from '@/lib/constants/marca'

export const runtime = 'nodejs'

const SIN_CACHE = { 'Cache-Control': 'private, no-store' } as const

type Cliente = NonNullable<ReturnType<typeof createServiceClient>>

// El bucket `branding` es público porque el logo se muestra a todo usuario activo;
// la lectura no exige admin. La escritura sí, y ocurre solo aquí con service role:
// el bucket no declara policies de INSERT/UPDATE/DELETE, así que un usuario no puede
// escribir en Storage aunque conozca la ruta. Cada objeto lleva nombre versionado,
// de modo que el navegador nunca reutiliza una imagen ya descargada.
async function leerUrl(admin: Cliente): Promise<string> {
  const { data } = await admin.from('configuraciones_sistema').select('valor').eq('clave', LOGO_CLAVE).maybeSingle()
  return urlLogoValida(data?.valor)
}

/** Ruta del objeto solo si la URL pertenece al bucket de marca; evita borrar ajenos. */
function rutaDelBucket(url: string): string | null {
  const prefijo = `/object/public/${LOGO_BUCKET}/`
  const corte = url.indexOf(prefijo)
  if (corte === -1) return null
  const ruta = decodeURIComponent(url.slice(corte + prefijo.length).split('?')[0])
  return ruta.length === 0 || ruta.includes('..') ? null : ruta
}

async function guardarClave(admin: Cliente, url: string) {
  return admin.from('configuraciones_sistema').upsert({
    clave: LOGO_CLAVE, valor: url,
    descripcion: 'URL pública del logo mostrado en el menú lateral', categoria: 'general',
  }, { onConflict: 'clave' }).select('valor').single()
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request, request.signal)
  if (!user) return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
  const admin = createServiceClient(request.signal)
  if (!admin) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500 })
  const { data, error } = await admin.from('configuraciones_sistema')
    .select('valor').eq('clave', LOGO_CLAVE).maybeSingle()
  if (error) return NextResponse.json({ error: 'No se pudo consultar el logo' }, { status: 500 })
  return NextResponse.json({ logoUrl: urlLogoValida(data?.valor) }, { headers: SIN_CACHE })
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request, request.signal)
  if (!user) return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
  if (user.rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede cambiar el logo' }, { status: 403 })
  const formulario = await request.formData().catch(() => null)
  const archivo = formulario?.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: 'Adjunta la imagen del logo' }, { status: 400 })
  }
  if (!esLogoTipo(archivo.type)) return NextResponse.json({ error: 'Formato no admitido. Usa PNG, JPG o WebP.' }, { status: 400 })
  if (archivo.size > LOGO_MAX_BYTES) return NextResponse.json({ error: 'La imagen supera los 2 MB permitidos' }, { status: 400 })
  const admin = createServiceClient(request.signal)
  if (!admin) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500 })

  const previa = await leerUrl(admin)
  const ruta = `logo-${Date.now()}.${logoExtension(archivo.type)}`
  const subida = await admin.storage.from(LOGO_BUCKET)
    .upload(ruta, await archivo.arrayBuffer(), { contentType: archivo.type, cacheControl: '31536000', upsert: false })
  if (subida.error) return NextResponse.json({ error: 'No se pudo guardar la imagen' }, { status: 500 })

  const { data: publica } = admin.storage.from(LOGO_BUCKET).getPublicUrl(ruta)
  const guardado = await guardarClave(admin, publica.publicUrl)
  if (guardado.error || !guardado.data) {
    // Sin fila persistida el objeto queda sin referencia: se retira antes de responder.
    await admin.storage.from(LOGO_BUCKET).remove([ruta])
    return NextResponse.json({ error: 'No se pudo guardar el logo' }, { status: 500 })
  }
  const obsoleta = rutaDelBucket(previa)
  if (obsoleta) await admin.storage.from(LOGO_BUCKET).remove([obsoleta])
  return NextResponse.json({ logoUrl: publica.publicUrl }, { headers: SIN_CACHE })
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request, request.signal)
  if (!user) return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
  if (user.rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede quitar el logo' }, { status: 403 })
  const admin = createServiceClient(request.signal)
  if (!admin) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500 })

  const ruta = rutaDelBucket(await leerUrl(admin))
  if (ruta) {
    // Si el archivo no se puede borrar se conserva la clave: limpiarla dejaría el
    // objeto huérfano y sin forma de localizarlo desde la aplicación.
    const borrado = await admin.storage.from(LOGO_BUCKET).remove([ruta])
    if (borrado.error) return NextResponse.json({ error: 'No se pudo eliminar la imagen' }, { status: 500 })
  }
  const limpiado = await guardarClave(admin, '')
  if (limpiado.error) return NextResponse.json({ error: 'No se pudo quitar el logo' }, { status: 500 })
  return NextResponse.json({ logoUrl: '' }, { headers: SIN_CACHE })
}
