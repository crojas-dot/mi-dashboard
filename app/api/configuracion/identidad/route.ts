import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { rateLimit } from '@/lib/server/rateLimit'
import { LOGO_BUCKET } from '@/lib/constants/marca'
import { IDENTIDAD_ACCEPT, IDENTIDAD_IMAGENES, IDENTIDAD_MAX_BYTES, IDENTIDAD_SLOTS, IDENTIDAD_STORED_BYTES, esImagenIdentidad, rutaImagenIdentidad, urlIdentidadValida, type ImagenIdentidad } from '@/lib/constants/identidad'

export const runtime = 'nodejs'

const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: HEADERS })
const fail = (error: string, status: number) => json({ error }, status)

type Admin = NonNullable<ReturnType<typeof createServiceClient>>

async function actual(admin: Admin, slot: ImagenIdentidad): Promise<string> {
  const { data, error } = await admin.from('configuraciones_sistema')
    .select('valor').eq('clave', IDENTIDAD_IMAGENES[slot].clave).maybeSingle()
  if (error) throw new Error('No se pudo consultar la imagen')
  return urlIdentidadValida(slot, data?.valor)
}

async function publicar(admin: Admin, slot: ImagenIdentidad, imagen: string) {
  const item = IDENTIDAD_IMAGENES[slot]
  return admin.from('configuraciones_sistema').upsert({
    clave: item.clave, categoria: 'identidad', descripcion: item.descripcion, valor: imagen,
  }, { onConflict: 'clave' }).select('valor').single()
}

async function accesoAdmin(request: NextRequest) {
  const user = await getCurrentUser(request, request.signal)
  if (!user) return { error: fail('Sesión no válida', 401) } as const
  if (user.rol !== 'admin') return { error: fail('Solo un administrador puede modificar estas imágenes', 403) } as const
  const admin = createServiceClient(request.signal)
  if (!admin) return { error: fail('Servicio de imágenes no disponible', 503) } as const
  return { user, admin } as const
}

/** Las URL son públicas; no se exponen otras configuraciones ni datos de usuario. */
export async function GET(request: NextRequest) {
  const admin = createServiceClient(request.signal)
  if (!admin) return fail('Servicio de imágenes no disponible', 503)
  const { data, error } = await admin.from('configuraciones_sistema')
    .select('clave,valor').in('clave', IDENTIDAD_SLOTS.map(slot => IDENTIDAD_IMAGENES[slot].clave))
  if (error) return fail('No se pudieron consultar las imágenes', 503)
  const imagenes = Object.fromEntries(IDENTIDAD_SLOTS.map(slot => [
    slot, urlIdentidadValida(slot, data?.find(item => item.clave === IDENTIDAD_IMAGENES[slot].clave)?.valor),
  ]))
  return json({ imagenes })
}

export async function PUT(request: NextRequest) {
  const context = await accesoAdmin(request)
  if ('error' in context) return context.error
  if (!rateLimit(context.user.id, 10, 60_000, 'identidad-imagenes')) return fail('Demasiados cambios. Intentá de nuevo en un minuto', 429)
  const form = await request.formData().catch(() => null)
  const slot = form?.get('slot')
  const archivo = form?.get('archivo')
  if (!esImagenIdentidad(slot)) return fail('Tipo de imagen no permitido', 400)
  if (!(archivo instanceof File) || archivo.size === 0 || archivo.size > IDENTIDAD_MAX_BYTES
    || !IDENTIDAD_ACCEPT.split(',').includes(archivo.type)) {
    return fail('Elegí un archivo PNG, JPG o WebP de hasta 4 MB', 400)
  }
  const meta = IDENTIDAD_IMAGENES[slot]
  let bytes: Buffer
  try {
    const sharp = (await import('sharp')).default
    const source = sharp(Buffer.from(await archivo.arrayBuffer()), { limitInputPixels: 16_000_000, failOn: 'warning' })
    const info = await source.metadata()
    if (!info.width || !info.height || (info.pages ?? 1) > 1 ||
      !(['image/jpeg','image/png','image/webp'] as string[]).includes(archivo.type) ||
      `image/${info.format}` !== archivo.type) {
      return fail('La imagen no es válida o contiene animación', 415)
    }
    bytes = await source.autoOrient().resize(meta.ancho, meta.alto, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82, effort: 4 }).toBuffer()
  } catch { return fail('La imagen no es válida o supera 16 megapíxeles', 415) }
  if (bytes.length > IDENTIDAD_STORED_BYTES) return fail('La imagen optimizada supera 2 MB', 413)

  let anterior: string
  try { anterior = await actual(context.admin, slot) }
  catch { return fail('No se pudo consultar la imagen anterior', 503) }

  const ruta = `identidad/${slot}/${randomUUID()}.webp`
  const subida = await context.admin.storage.from(LOGO_BUCKET).upload(ruta, bytes, {
    contentType: 'image/webp', upsert: false, cacheControl: '31536000',
  })
  if (subida.error) return fail('No se pudo guardar la imagen en Storage', 503)
  const url = context.admin.storage.from(LOGO_BUCKET).getPublicUrl(ruta).data.publicUrl
  if (!urlIdentidadValida(slot, url)) {
    await context.admin.storage.from(LOGO_BUCKET).remove([ruta])
    return fail('No se pudo validar la ubicación de la imagen', 503)
  }
  const resultado = await publicar(context.admin, slot, url)
  if (resultado.error || !resultado.data) {
    await context.admin.storage.from(LOGO_BUCKET).remove([ruta])
    return fail('No se pudo publicar la imagen', 503)
  }
  const vieja = rutaImagenIdentidad(slot, anterior)
  if (vieja && vieja !== ruta) void context.admin.storage.from(LOGO_BUCKET).remove([vieja])
  return json({ slot, imagen: url })
}

export async function DELETE(request: NextRequest) {
  const context = await accesoAdmin(request)
  if ('error' in context) return context.error
  const body = await request.json().catch(() => null) as { slot?: unknown } | null
  if (!esImagenIdentidad(body?.slot)) return fail('Tipo de imagen no permitido', 400)
  const slot = body.slot
  let anterior: string
  try { anterior = await actual(context.admin, slot) }
  catch { return fail('No se pudo consultar la imagen anterior', 503) }
  const resultado = await publicar(context.admin, slot, '')
  if (resultado.error || !resultado.data) return fail('No se pudo quitar la imagen', 503)
  const ruta = rutaImagenIdentidad(slot, anterior)
  if (ruta) void context.admin.storage.from(LOGO_BUCKET).remove([ruta])
  return json({ slot, imagen: '' })
}
