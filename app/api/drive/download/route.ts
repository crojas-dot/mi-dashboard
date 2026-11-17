import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { createAuthenticatedClient, getCurrentUser } from '@/lib/server/auth'
import { getDriveClient, assertDriveCaseFile } from '@/lib/server/drive'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

function contentDisposition(nombre: string): string {
  const asciiName = nombre.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(nombre)}`
}

export async function GET(request: NextRequest) {
  const current = await getCurrentUser(request, request.signal)
  if (!current) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const fileId = request.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return NextResponse.json({ error: 'ID de archivo inválido' }, { status: 400 })
  if (!['admin', 'calidad', 'colaborador'].includes(current.rol)) {
    return NextResponse.json({ error: 'Sin permisos para descargar este adjunto' }, { status: 403 })
  }
  const client = createAuthenticatedClient(request, request.signal)
  if (!client) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    // El INNER aplica la misma RLS de Quejas que protege la bandeja. Una fila de
    // adjunto visible por sí sola no prueba acceso vigente al expediente.
    const { data: adjunto, error: lookupError } = await client.from('queja_adjuntos')
      .select('nombre, tipo_mime, queja:quejas!inner(folio, responsable_id)')
      .eq('storage_path', fileId).limit(1).maybeSingle<{
        nombre: string; tipo_mime: string | null; queja: { folio: string; responsable_id: string | null }
      }>()
    if (lookupError) throw lookupError
    if (!adjunto?.queja) return NextResponse.json({ error: 'Adjunto no disponible' }, { status: 404 })
    if (current.rol === 'colaborador' && adjunto.queja.responsable_id !== current.id) {
      return NextResponse.json({ error: 'Sin permisos para descargar este adjunto' }, { status: 403 })
    }
    const admin = createServiceClient(request.signal)
    if (!admin) return NextResponse.json({ error: 'Servicio de evidencias no disponible' }, { status: 503 })
    const { data: config, error: configError } = await admin.from('configuraciones_sistema').select('valor').eq('clave', 'drive_folder_id_quejas').maybeSingle()
    if (configError) throw configError
    const root = typeof config?.valor === 'string' ? config.valor.trim() : ''
    const drive = getDriveClient()
    if (!root || !drive) return NextResponse.json({ error: 'Servicio de evidencias no disponible' }, { status: 503 })
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)])
    await assertDriveCaseFile(drive, root, fileId, adjunto.queja.folio, { signal })
    if (request.nextUrl.searchParams.get('vista') === 'drive') {
      // Solo devuelve la vista privada del archivo confirmado. Drive aplica además
      // los permisos de la cuenta de Google; nunca se crea un permiso compartido.
      return NextResponse.json({ previewUrl: `https://drive.google.com/file/d/${fileId}/preview` }, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }
    const result = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream', signal })
    const stream = Readable.toWeb(result.data as Readable) as ReadableStream<Uint8Array>
    // Gaxios actual usa Headers; fixtures/transportes antiguos pueden devolver un mapa.
    const transportHeaders = result.headers as unknown as { get?: (name: string) => string | null } & Record<string, unknown>
    const driveHeader = (name: string) => typeof transportHeaders.get === 'function' ? transportHeaders.get(name) : transportHeaders[name]
    const reportedMime = String(driveHeader('content-type') ?? adjunto.tipo_mime ?? '').split(';')[0].trim().toLowerCase()
    const mime = new RegExp('^[a-z0-9][a-z0-9.+_-]*/[a-z0-9][a-z0-9.+_-]*$').test(reportedMime) ? reportedMime : 'application/octet-stream'
    const headers = new Headers({
      'Content-Type': mime,
      'Content-Disposition': contentDisposition(adjunto.nombre),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    })
    const contentLength = driveHeader('content-length')
    if (contentLength) headers.set('Content-Length', String(contentLength))
    return new NextResponse(stream, { status: 200, headers })
  } catch (error) {
    const source = error as { code?: string | number; response?: { status?: number } }
    const status = source.code === 'DRIVE_EVIDENCE_SCOPE' ? 403 : source.code === 'DRIVE_FILE_MISSING' || source.response?.status === 404 || source.code === 404 ? 404 : 502
    logger.error('No se pudo descargar un archivo de Drive', { module: 'drive', action: 'download', status }, error)
    return NextResponse.json({ error: status === 403 ? 'El archivo no pertenece al expediente' : status === 404 ? 'El archivo ya no existe en Google Drive' : 'No se pudo descargar el archivo desde Google Drive' }, { status })
  }
}
