import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { getDriveClient } from '@/lib/server/drive'

export const runtime = 'nodejs'

function contentDisposition(nombre: string): string {
  const asciiName = nombre.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(nombre)}`
}

export async function GET(request: NextRequest) {
  const current = await getCurrentUser(request)
  if (!current) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const fileId = request.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!fileId) {
    return NextResponse.json({ error: 'Falta el parámetro "id"' }, { status: 400 })
  }

  const { data: adjunto } = await admin
    .from('queja_adjuntos')
    .select('queja_id, nombre, tipo_mime')
    .eq('storage_path', fileId)
    .limit(1)
    .maybeSingle()
  if (!adjunto) {
    return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })
  }

  const esStaff = ['admin', 'calidad'].includes(current.rol)
  if (!esStaff) {
    const { data: perfil } = await admin
      .from('usuarios')
      .select('id')
      .eq('auth_id', current.auth_id)
      .maybeSingle()
    let queja: { responsable_id: string | null } | null = null
    if (perfil) {
      const { data } = await admin
        .from('quejas')
        .select('responsable_id')
        .eq('id', adjunto.queja_id)
        .maybeSingle()
      queja = data
    }
    if (!perfil || !queja || queja.responsable_id !== perfil.id) {
      return NextResponse.json({ error: 'Sin permisos para descargar este adjunto' }, { status: 403 })
    }
  }

  const drive = getDriveClient()
  if (!drive) {
    return NextResponse.json(
      { error: 'Servidor mal configurado: faltan GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY' },
      { status: 500 },
    )
  }

  try {
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' },
    )
    const stream = Readable.toWeb(res.data as Readable) as ReadableStream<Uint8Array>
    const headers = new Headers({
      'Content-Type': adjunto.tipo_mime || 'application/octet-stream',
      'Content-Disposition': contentDisposition(adjunto.nombre),
      'Cache-Control': 'no-store',
    })
    const contentLength = res.headers['content-length']
    if (contentLength) headers.set('Content-Length', String(contentLength))
    return new NextResponse(stream, { status: 200, headers })
  } catch (error) {
    const httpStatus =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number }; message?: string }).response?.status
        : undefined
    const mensaje = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[api/drive/download]', mensaje)
    if (httpStatus === 404) {
      return NextResponse.json({ error: 'El archivo ya no existe en Google Drive' }, { status: 404 })
    }
    return NextResponse.json({ error: `No se pudo descargar desde Google Drive: ${mensaje}` }, { status: 502 })
  }
}
