import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { AVATAR_ACCEPT, AVATAR_BUCKET, AVATAR_STORED_BYTES, AVATAR_UPLOAD_BYTES, rutaAvatar } from '@/lib/constants/avatar'
import { getCurrentUser } from '@/lib/server/auth'
import { rateLimit } from '@/lib/server/rateLimit'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { streamToBuffer, UploadBodyTooLargeError } from '@/lib/server/uploadHelpers'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
const json = (value: object, status = 200) => NextResponse.json(value, { status, headers: PRIVATE })
const invalid = (message: string, status: number) => json({ error: message }, status)

async function profileContext(request: NextRequest) {
  const actor = await getCurrentUser(request, request.signal)
  if (!actor) return { response: invalid('Sesión no válida', 401) } as const
  const admin = createServiceClient()
  if (!admin) return { response: invalid('Servicio de fotos no disponible', 503) } as const
  const profile = () => admin.from('usuarios').select('avatar_url')
    .eq('id', actor.id).eq('auth_id', actor.auth_id).eq('estado', 'activo').maybeSingle()
  const { data, error } = await profile()
  if (error) return { response: invalid('No se pudo consultar tu foto', 503) } as const
  if (!data) return { response: invalid('Sesión no válida', 401) } as const
  return { actor, admin, previous: data.avatar_url as string | null, profile } as const
}

type Context = Exclude<Awaited<ReturnType<typeof profileContext>>, { response: NextResponse }>

async function publishPhoto(context: Context, next: string | null) {
  const { actor, admin, previous } = context
  const update = admin.from('usuarios').update({ avatar_url: next })
    .eq('id', actor.id).eq('auth_id', actor.auth_id).eq('estado', 'activo')
  // Una operación concurrente puede haber guardado otra foto mientras se subía.
  const guarded = previous === null ? update.is('avatar_url', null) : update.eq('avatar_url', previous)
  return guarded.select('id').maybeSingle()
}

async function removePhoto(context: Context, path: string | null) {
  const owned = rutaAvatar(path, context.actor.id)
  if (!owned) return
  try {
    const { error } = await context.admin.storage.from(AVATAR_BUCKET).remove([owned])
    if (error) logger.warn('No se pudo retirar una versión de la foto', { module: 'perfil', action: 'limpiar_avatar' })
  } catch {
    logger.warn('No se pudo retirar una versión de la foto', { module: 'perfil', action: 'limpiar_avatar' })
  }
}

export async function GET(request: NextRequest) {
  const context = await profileContext(request)
  if ('response' in context) return context.response
  const path = rutaAvatar(context.previous, context.actor.id)
  if (!path) return invalid('No hay foto de perfil', 404)
  const { data, error } = await context.admin.storage.from(AVATAR_BUCKET).download(path, {}, { signal: request.signal })
  if (error || !data || data.size > AVATAR_STORED_BYTES) return invalid('Foto no disponible', 404)
  return new NextResponse(data, { headers: { ...PRIVATE, 'Content-Type': 'image/webp' } })
}

export async function PUT(request: NextRequest) {
  const context = await profileContext(request)
  if ('response' in context) return context.response
  if (!rateLimit(context.actor.id, 6, 60_000, 'perfil-avatar')) return invalid('Esperá un minuto para cambiar tu foto', 429)
  const mime = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (!mime || !AVATAR_ACCEPT.split(',').includes(mime)) return invalid('Usá una imagen JPG, PNG o WebP', 415)
  if (!request.body) return invalid('Elegí una imagen', 400)
  if (Number(request.headers.get('content-length')) > AVATAR_UPLOAD_BYTES) return invalid('La foto supera 2 MB', 413)

  let bytes: Buffer
  try {
    bytes = await streamToBuffer(request.body, AVATAR_UPLOAD_BYTES)
  } catch (error) {
    return error instanceof UploadBodyTooLargeError
      ? invalid('La foto supera 2 MB', 413) : invalid('No se pudo leer la foto', 400)
  }

  let photo: Buffer
  try {
    const { default: sharp } = await import('sharp')
    const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'warning' })
    const { format, pages } = await image.metadata()
    if (`image/${format}` !== mime || (pages ?? 1) > 1) return invalid('Elegí una imagen válida y sin animación', 415)
    // La nueva imagen elimina metadatos y evita enviar una foto completa al header.
    photo = await image.autoOrient().resize(320, 320, { fit: 'cover' }).webp({ quality: 83 }).toBuffer()
  } catch {
    return invalid('Usá una imagen válida de hasta 16 megapíxeles', 415)
  }
  if (photo.length > AVATAR_STORED_BYTES) return invalid('La foto es demasiado grande', 413)
  const path = `${context.actor.id}/${randomUUID()}.webp`
  const { error } = await context.admin.storage.from(AVATAR_BUCKET).upload(path, photo, { contentType: 'image/webp', upsert: false })
  if (error) return invalid('No se pudo guardar tu foto', 503)

  const stored = await publishPhoto(context, path)
  if (stored.error) {
    // Una respuesta perdida puede haber publicado la foto. Confirmar con una
    // lectura antes de retirar el posible objeto vigente.
    const confirmed = await context.profile()
    if (confirmed.error) return invalid('No se pudo confirmar el cambio. Recargá tu perfil.', 503)
    if (confirmed.data?.avatar_url !== path) {
      await removePhoto(context, path)
      return invalid('No se pudo guardar tu foto', 503)
    }
  } else if (!stored.data) {
    await removePhoto(context, path)
    return invalid('La foto cambió. Recargá tu perfil para volver a intentar.', 409)
  }
  await removePhoto(context, context.previous)
  return json({ avatarUrl: path })
}

export async function DELETE(request: NextRequest) {
  const context = await profileContext(request)
  if ('response' in context) return context.response
  if (!rutaAvatar(context.previous, context.actor.id)) return json({ avatarUrl: null })
  const result = await publishPhoto(context, null)
  if (result.error) return invalid('No se pudo confirmar el cambio. Recargá tu perfil.', 503)
  if (!result.data) return invalid('La foto cambió. Recargá tu perfil para volver a intentar.', 409)
  await removePhoto(context, context.previous)
  return json({ avatarUrl: null })
}
