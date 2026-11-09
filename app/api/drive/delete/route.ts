import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { getDriveClient, assertDriveCaseFile, eliminarArchivoDrive } from '@/lib/server/drive'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'
import { streamToBuffer } from '@/lib/server/uploadHelpers'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function DELETE(request: NextRequest) {
  if (!rateLimit(getClientIp(request), 30, 60_000, 'drive/delete')) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' }, { status: 429 })
  }
  const current = await getCurrentUser(request)
  if (!current) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const admin = createServiceClient()
  if (!admin) return NextResponse.json({ error: 'Servicio de evidencias no disponible' }, { status: 503 })
  let adjuntoId: unknown
  try {
    if (!request.body) throw new Error('Empty body')
    const input = JSON.parse((await streamToBuffer(request.body, 8 * 1024)).toString('utf8')) as Record<string, unknown>
    if (!input || Array.isArray(input) || Object.keys(input).some(key => key !== 'adjuntoId')) throw new Error('Invalid body')
    adjuntoId = input.adjuntoId
  } catch { return NextResponse.json({ error: 'Solicitud de eliminación inválida' }, { status: 400 }) }
  if (!adjuntoId || typeof adjuntoId !== 'string' || adjuntoId.length > 200 || /[\x00-\x1f\x7f]/.test(adjuntoId)) {
    return NextResponse.json({ error: 'Se requiere adjuntoId válido' }, { status: 400 })
  }

  try {
    const { data: adjunto, error: adjuntoError } = await admin.from('queja_adjuntos').select('id, queja_id, storage_path, usuario_id').eq('id', adjuntoId).maybeSingle()
    if (adjuntoError) throw adjuntoError
    if (!adjunto) return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })
    const { data: queja, error: caseError } = await admin.from('quejas').select('folio, responsable_id').eq('id', adjunto.queja_id).maybeSingle()
    if (caseError) throw caseError
    if (!queja) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 })
    if (adjunto.usuario_id === null && current.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar evidencias del cliente' }, { status: 403 })
    }
    if (adjunto.usuario_id !== null && !['admin', 'calidad'].includes(current.rol) && !(current.rol === 'colaborador' && queja.responsable_id === current.id)) {
      return NextResponse.json({ error: 'Sin permisos para eliminar esta evidencia' }, { status: 403 })
    }

    // Reservar antes del efecto externo impide publicar un oficio mientras se borra en Drive.
    // Solo se permite compatibilidad si el RPC todavía no existe, nunca ante un rechazo suyo.
    const { error: claimError } = await admin.rpc('qms_claim_attachment_delete', { p_adjunto_id: adjuntoId, p_actor_id: current.id })
    if (claimError && !(claimError.code === 'PGRST202' && process.env.PUBLIC_TRACKING_ENABLED !== 'true')) {
      const conflict = ['42501', '23503', '55000'].includes(claimError.code)
      return NextResponse.json({ error: conflict ? 'El documento está publicado o no puede eliminarse. Conservá el oficio del expediente.' : 'No se pudo comprobar si el documento puede eliminarse.' }, { status: conflict ? 409 : 503 })
    }

    if (adjunto.storage_path && !adjunto.storage_path.includes('/')) {
      const { data: config, error: configError } = await admin.from('configuraciones_sistema').select('valor').eq('clave', 'drive_folder_id_quejas').maybeSingle()
      if (configError) throw configError
      const root = typeof config?.valor === 'string' ? config.valor.trim() : ''
      const drive = getDriveClient()
      if (!root || !drive) return NextResponse.json({ error: 'Servicio de evidencias no disponible' }, { status: 503 })
      let fileAlreadyMissing = false
      try {
        const origin = await assertDriveCaseFile(drive, root, adjunto.storage_path, queja.folio, { allowTrashedFile: true })
        // Una fila legacy pudo falsificar usuario_id: la ubicación real decide el origen.
        if (origin === 'public' && current.rol !== 'admin') {
          return NextResponse.json({ error: 'Solo los administradores pueden eliminar evidencias del cliente' }, { status: 403 })
        }
      }
      catch (error) {
        // Si un primer borrado terminó en Drive pero falló en DB, 404 permite limpiar la fila.
        const source = error as { code?: string | number; response?: { status?: number } }
        if (source.code !== 'DRIVE_FILE_MISSING') throw error
        fileAlreadyMissing = true
      }
      if (!fileAlreadyMissing && !(await eliminarArchivoDrive(adjunto.storage_path))) {
        return NextResponse.json({ error: 'No se pudo eliminar el archivo en Drive. El registro se conserva; intentá de nuevo.' }, { status: 502 })
      }
    }
    const { error: deleteError } = await admin.from('queja_adjuntos').delete().eq('id', adjuntoId).eq('storage_path', adjunto.storage_path)
    if (deleteError) {
      logger.error('No se pudo eliminar el registro del adjunto', { module: 'drive', action: 'delete_record' }, deleteError)
      return NextResponse.json({ error: 'No se pudo eliminar el adjunto' }, { status: 500 })
    }
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const forbidden = (error as { code?: string })?.code === 'DRIVE_EVIDENCE_SCOPE'
    logger.error('No se pudo eliminar la evidencia', { module: 'drive', action: 'delete' }, error)
    return NextResponse.json({ error: forbidden ? 'El archivo no pertenece al expediente' : 'No se pudo eliminar el archivo. El registro se conserva.' }, { status: forbidden ? 403 : 502 })
  }
}
