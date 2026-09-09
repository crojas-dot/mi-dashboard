import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getDriveClient, buscarOCrearSubcarpeta, subirArchivoASubcarpeta } from '@/lib/server/drive'
import { MAX_FILE_BYTES, PLACEHOLDER_PREFIX, ALLOWED_MIME_TYPES, streamToBuffer, readUploadForm, UploadBodyTooLargeError } from '@/lib/server/uploadHelpers'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'

import { programarContextoDrive } from '@/lib/server/driveContext'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, 30, 60_000, 'drive/upload-public')) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' }, { status: 429 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await readUploadForm(request)
  } catch (error) {
    return NextResponse.json({ error: error instanceof UploadBodyTooLargeError ? 'El archivo supera el máximo de 4 MB' : 'FormData inválido' }, { status: error instanceof UploadBodyTooLargeError ? 413 : 400 })
  }

  const file = formData.get('file')
  const folio = String(formData.get('folio') ?? '').trim()
  const token = String(formData.get('token') ?? '').trim()
  if (!(file instanceof File) || !folio || !token) {
    return NextResponse.json({ error: 'Se requieren "file", "folio" y "token"' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el máximo de 4 MB' }, { status: 413 })
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: `Tipo de archivo no permitido: ${mimeType}` }, { status: 415 })
  }

  const { data: formulario } = await admin
    .from('formularios_publicos')
    .select('id, nombre')
    .eq('token', token)
    .eq('activo', true)
    .maybeSingle()
  if (!formulario) {
    return NextResponse.json({ error: 'Formulario no válido o inactivo' }, { status: 403 })
  }

  const { data: queja } = await admin
    .from('quejas')
    .select('id, estado')
    .eq('folio', folio)
    .maybeSingle()
  if (!queja) {
    return NextResponse.json({ error: 'No se encontró la queja para este folio' }, { status: 404 })
  }
  if (queja.estado !== 'Recibido') {
    return NextResponse.json(
      { error: 'Ya no se pueden agregar evidencias a esta queja' },
      { status: 409 },
    )
  }

  const { data: config } = await admin
    .from('configuraciones_sistema')
    .select('valor')
    .eq('clave', 'drive_folder_id_quejas')
    .maybeSingle()
  const rootFolderId = typeof config?.valor === 'string' ? config.valor.trim() : ''
  if (!rootFolderId || rootFolderId.startsWith(PLACEHOLDER_PREFIX)) {
    return NextResponse.json(
      { error: 'Falta configurar drive_folder_id_quejas en Configuración → General' },
      { status: 500 },
    )
  }

  const drive = getDriveClient()
  if (!drive) {
    return NextResponse.json(
      { error: 'Servidor mal configurado: faltan GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY' },
      { status: 500 },
    )
  }

  try {
    const buffer = await streamToBuffer(file.stream(), MAX_FILE_BYTES)
    const subcarpetaId = await buscarOCrearSubcarpeta(drive, rootFolderId, folio)
    const resultado = await subirArchivoASubcarpeta(subcarpetaId, {
      nombre: file.name,
      tipoMime: file.type || 'application/octet-stream',
      buffer,
    })

    programarContextoDrive(subcarpetaId)

    return NextResponse.json({
      drive_file_id: resultado.id,
      name: resultado.name ?? file.name,
      mimeType: resultado.mimeType ?? (file.type || 'application/octet-stream'),
      folder_id: subcarpetaId,
      queja_id: queja.id,
    })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al subir archivo a Drive'
    console.error('[api/drive/upload-public]', mensaje)
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}
