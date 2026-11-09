import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { getDriveClient, assertDriveCaseFile } from '@/lib/server/drive'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

function contentDisposition(nombre: string): string {
  const asciiName = nombre.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(nombre)}`
}

export async function GET(request: NextRequest) {
  const current = await getCurrentUser(request)
  if (!current) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const admin = createServiceClient()
  if (!admin) return NextResponse.json({ error: 'Servicio de evidencias no disponible' }, { status: 503 })
  const fileId = request.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return NextResponse.json({ error: 'ID de archivo inválido' }, { status: 400 })

  try {
    const { data: adjunto, error: adjuntoError } = await admin.from('queja_adjuntos').select('queja_id, nombre, tipo_mime').eq('storage_path', fileId).limit(1).maybeSingle()
    if (adjuntoError) throw adjuntoError
    if (!adjunto) return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })
    const { data: queja, error: caseError } = await admin.from('quejas').select('folio, responsable_id').eq('id', adjunto.queja_id).maybeSingle()
    if (caseError) throw caseError
    if (!queja) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 })
    if (!['admin', 'calidad'].includes(current.rol) && !(current.rol === 'colaborador' && queja.responsable_id === current.id)) {
      return NextResponse.json({ error: 'Sin permisos para descargar este adjunto' }, { status: 403 })
    }
    const { data: config, error: configError } = await admin.from('configuraciones_sistema').select('valor').eq('clave', 'drive_folder_id_quejas').maybeSingle()
    if (configError) throw configError
    const root = typeof config?.valor === 'string' ? config.valor.trim() : ''
    const drive = getDriveClient()
    if (!root || !drive) return NextResponse.json({ error: 'Servicio de evidencias no disponible' }, { status: 503 })
    await assertDriveCaseFile(drive, root, fileId, queja.folio)
    const result = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' })
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
