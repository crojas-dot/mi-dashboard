import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { getDriveClient, assertPrivateDriveFolder, assertDriveCaseFile, buscarOCrearSubcarpeta, subirArchivoASubcarpeta, eliminarArchivoDrive } from '@/lib/server/drive'
import { MAX_FILE_BYTES, PLACEHOLDER_PREFIX, ALLOWED_MIME_TYPES, streamToBuffer, readUploadForm, UploadBodyTooLargeError } from '@/lib/server/uploadHelpers'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'
import { programarContextoDrive } from '@/lib/server/driveContext'
import { logger } from '@/lib/utils/logger'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, 30, 60_000, 'drive/upload')) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' }, { status: 429 })
  }
  const current = await getCurrentUser(request)
  if (!current) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const admin = createServiceClient()
  if (!admin) return NextResponse.json({ error: 'Servicio de evidencias no disponible' }, { status: 503 })

  let formData: FormData
  try { formData = await readUploadForm(request) }
  catch (error) {
    return NextResponse.json({ error: error instanceof UploadBodyTooLargeError ? 'El archivo supera el máximo de 4 MB' : 'FormData inválido' }, { status: error instanceof UploadBodyTooLargeError ? 413 : 400 })
  }
  // El cliente elige la queja y los bytes, nunca el usuario, carpeta ni Drive ID.
  if ([...formData.keys()].some(key => !['file', 'queja_id'].includes(key)) || formData.getAll('file').length !== 1 || formData.getAll('queja_id').length !== 1) {
    return NextResponse.json({ error: 'Campos de adjunto inválidos' }, { status: 400 })
  }
  const file = formData.get('file')
  const quejaId = String(formData.get('queja_id') ?? '').trim()
  if (!(file instanceof File) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(quejaId)) {
    return NextResponse.json({ error: 'Se requieren archivo y queja válidos' }, { status: 400 })
  }
  if (file.size === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'El archivo supera el máximo de 4 MB' }, { status: 413 })
  const filename = file.name.normalize('NFC').split(/[\\/]/).pop()?.trim() ?? ''
  if (!filename || filename.length > 255 || /[\x00-\x1f\x7f]/.test(filename)) {
    return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 })
  }
  const mimeType = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 415 })
  const { data: queja, error: quejaError } = await admin.from('quejas').select('folio, responsable_id').eq('id', quejaId).maybeSingle()
  if (quejaError) {
    logger.error('No se pudo consultar la queja para adjuntar', { module: 'drive', action: 'upload_case' }, quejaError)
    return NextResponse.json({ error: 'No se pudo consultar el expediente' }, { status: 503 })
  }
  if (!queja) return NextResponse.json({ error: 'Queja no encontrada' }, { status: 404 })
  if (!['admin', 'calidad'].includes(current.rol) && !(current.rol === 'colaborador' && queja.responsable_id === current.id)) {
    return NextResponse.json({ error: 'Sin permisos para adjuntar a esta queja' }, { status: 403 })
  }

  let uploadedId: string | null = null
  try {
    const { data: config, error: configError } = await admin.from('configuraciones_sistema').select('valor').eq('clave', 'drive_folder_id_quejas').maybeSingle()
    if (configError) throw configError
    const rootFolderId = typeof config?.valor === 'string' ? config.valor.trim() : ''
    const drive = getDriveClient()
    if (!rootFolderId || rootFolderId.startsWith(PLACEHOLDER_PREFIX) || !drive) {
      return NextResponse.json({ error: 'Servicio de evidencias no disponible' }, { status: 503 })
    }
    const buffer = await streamToBuffer(file.stream(), MAX_FILE_BYTES)
    await assertPrivateDriveFolder(drive, rootFolderId)
    const carpetaQuejaId = await buscarOCrearSubcarpeta(drive, rootFolderId, queja.folio)
    await assertPrivateDriveFolder(drive, carpetaQuejaId)
    const carpetaAnalisisId = await buscarOCrearSubcarpeta(drive, carpetaQuejaId, 'Analisis')
    await assertPrivateDriveFolder(drive, carpetaAnalisisId)
    const resultado = await subirArchivoASubcarpeta(carpetaAnalisisId, { nombre: filename, tipoMime: mimeType, buffer })
    uploadedId = resultado.id
    await assertDriveCaseFile(drive, rootFolderId, uploadedId, queja.folio)
    // Solo registrar el ID recién creado por este handler; el RPC revalida actor y cuota.
    const { data, error } = await admin.rpc('registrar_adjunto_queja_servidor', {
      p_actor_id: current.id, p_queja_id: quejaId, p_nombre: filename,
      p_storage_path: uploadedId, p_tamano: file.size, p_tipo_mime: mimeType,
    })
    if (error) throw error
    const adjunto = data as QuejaAdjunto | null
    if (!adjunto?.id || adjunto.queja_id !== quejaId || adjunto.storage_path !== uploadedId) throw new Error('Registro de adjunto inválido')
    programarContextoDrive(carpetaQuejaId)
    return NextResponse.json({ adjunto }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // Una respuesta perdida puede ocultar un commit exitoso: consultar antes de borrar.
    if (uploadedId) {
      try {
        const { data: saved, error: lookupError } = await admin.from('queja_adjuntos').select('id, queja_id, nombre, storage_path, tamano, tipo_mime, usuario_id, created_at').eq('queja_id', quejaId).eq('storage_path', uploadedId).eq('usuario_id', current.id).maybeSingle()
        if (lookupError) throw lookupError
        if (saved) return NextResponse.json({ adjunto: saved }, { headers: { 'Cache-Control': 'no-store' } })
        await eliminarArchivoDrive(uploadedId)
      } catch (cause) {
        // Un fallo de consulta no demuestra que la transacción no hizo commit.
        logger.error('No se pudo reconciliar un adjunto en Drive', { module: 'drive', action: 'reconcile' }, cause)
      }
    }
    logger.error('No se pudo guardar la evidencia', { module: 'drive', action: 'upload' }, error)
    const code = (error as { code?: string })?.code
    const status = code === '42501' ? 403 : code === '54000' ? 409 : 502
    return NextResponse.json({ error: status === 403 ? 'Sin permisos para adjuntar a esta queja' : status === 409 ? 'Se alcanzó el límite de evidencias del expediente' : 'No se pudo guardar la evidencia. Comprueba el expediente antes de reintentar.' }, { status })
  }
}
