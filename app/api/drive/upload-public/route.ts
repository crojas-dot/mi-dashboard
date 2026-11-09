import { createHash } from 'node:crypto'
import { getDriveClient, buscarOCrearSubcarpeta, subirArchivoASubcarpeta, assertPrivateDriveFolder, eliminarArchivoDrive } from '@/lib/server/drive'
import { programarContextoDrive } from '@/lib/server/driveContext'
import { getPublicFormsConfig } from '@/lib/server/publicForms/config'
import { readPublicUpload } from '@/lib/server/publicForms/bodies'
import { validatePublicUploadForm, validatePublicFile } from '@/lib/server/publicForms/files'
import { verifyUploadCapability } from '@/lib/server/publicForms/uploadCapability'
import { verifyPublicBot } from '@/lib/server/publicForms/botProtection'
import { publicBackend, publicIpKey, consumePublicRate, publicRpc, publicReply, publicFailure, PublicGatewayError } from '@/lib/server/publicForms/gateway'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const maxDuration = 120
interface Reservation { reservation_id: string; status: 'reserved' | 'released' | 'committed'; created: boolean; adjunto_id: string | null; storage_path: string | null }

async function assertPrivateFolder(drive: NonNullable<ReturnType<typeof getDriveClient>>, id: string): Promise<void> {
  try { await assertPrivateDriveFolder(drive, id) }
  catch { throw new PublicGatewayError(503, 'public_storage_not_private') }
}

export async function POST(request: Request) {
  try {
    const { signingSecret } = getPublicFormsConfig()
    await verifyPublicBot(request)
    const { file, uploadToken, uploadId } = validatePublicUploadForm(await readPublicUpload(request))
    const claims = verifyUploadCapability(uploadToken, signingSecret)
    const client = publicBackend()
    await consumePublicRate(client, publicIpKey(request, signingSecret), 'upload')
    const buffer = Buffer.from(await file.arrayBuffer())
    const validFile = validatePublicFile(file, buffer)
    const scope = { p_form_id: claims.formId, p_submission_id: claims.submissionId, p_queja_id: claims.quejaId, p_upload_id: uploadId }
    const reserveArgs = { ...scope, p_content_hash: createHash('sha256').update(buffer).digest('hex'), p_nombre: validFile.filename, p_tipo_mime: validFile.mimeType, p_tamano: validFile.size }
    const reservation = await publicRpc<Reservation>(client, 'public_form_reserve_upload', reserveArgs)
    const receipt = (row: Reservation, idempotent = false) => {
      if (!row.storage_path || !row.adjunto_id) throw new PublicGatewayError(409, 'public_evidence_unavailable')
      return publicReply({ drive_file_id: row.storage_path.replace(/^drive:/, ''), queja_id: claims.quejaId, name: validFile.filename, mimeType: validFile.mimeType, idempotent })
    }
    if (reservation.status === 'committed') return receipt(reservation, true)
    if (!reservation.created) throw new PublicGatewayError(409, 'public_upload_pending')
    let drive: ReturnType<typeof getDriveClient> = null
    let uploadedId: string | null = null
    let uploadStarted = false
    const release = async () => {
      await publicRpc(client, 'public_form_release_upload', { ...scope, p_reservation_id: reservation.reservation_id })
    }
    const removeOwnedFile = async (): Promise<boolean> => {
      if (!uploadedId || !drive) return false
      return eliminarArchivoDrive(uploadedId)
    }
    try {
      // Después de reservar cuota, comprobar privacidad antes de escribir archivos en Drive.
      const { data: config, error: configError } = await client.from('configuraciones_sistema').select('valor').eq('clave', 'drive_folder_id_quejas').maybeSingle()
      if (configError) throw configError
      const root = typeof config?.valor === 'string' ? config.valor.trim() : ''
      drive = getDriveClient()
      if (!root || root.startsWith('REEMPLAZAME') || !drive) throw new PublicGatewayError(503, 'public_storage_unavailable')
      await assertPrivateFolder(drive, root)

      const { data: caseRow, error } = await client.from('quejas').select('folio').eq('id', claims.quejaId).single()
      if (error || !caseRow?.folio) throw error ?? new Error('Missing public case')
      const folder = await buscarOCrearSubcarpeta(drive, root, caseRow.folio)
      await assertPrivateFolder(drive, folder)
      uploadStarted = true
      const extension = validFile.mimeType === 'application/pdf' ? '.pdf' : validFile.mimeType === 'image/png' ? '.png' : '.jpg'
      const uploaded = await subirArchivoASubcarpeta(folder, { nombre: uploadId + extension, tipoMime: validFile.mimeType, buffer })
      uploadedId = uploaded.id
      await assertPrivateFolder(drive, uploadedId)
      const commit = await publicRpc<{ adjunto_id: string; storage_path: string }>(client, 'public_form_commit_upload', { ...scope, p_reservation_id: reservation.reservation_id, p_storage_path: 'drive:' + uploadedId })
      programarContextoDrive(folder)
      return publicReply({ drive_file_id: commit.storage_path.replace(/^drive:/, ''), queja_id: claims.quejaId, name: validFile.filename, mimeType: validFile.mimeType })
    } catch (error) {
      if (uploadedId) {
        // Perder la respuesta del commit no significa que falló la escritura.
        // La reserva bloquea la misma fila y permite confirmar antes de borrar.
        let reconciled: Reservation | null = null
        try { reconciled = await publicRpc<Reservation>(client, 'public_form_reserve_upload', reserveArgs) }
        catch (cause) { logger.error('No se pudo reconciliar subida pública', { module: 'public_forms', action: 'reconcile' }, cause) }
        if (reconciled?.status === 'committed') {
          if (reconciled.storage_path !== 'drive:' + uploadedId) await removeOwnedFile()
          return receipt(reconciled, true)
        }
        const knownRejected = error instanceof PublicGatewayError && error.status < 500
        if (reconciled || knownRejected) {
          if (await removeOwnedFile()) { try { await release() } catch (cause) { logger.error('Reserva pública pendiente de liberar', { module: 'public_forms', action: 'release' }, cause) } }
        }
      } else if (!uploadStarted || (error as { outcome?: string })?.outcome === 'rejected') {
        try { await release() } catch (cause) { logger.error('Reserva pública pendiente de liberar', { module: 'public_forms', action: 'release' }, cause) }
      }
      // Timeout de Drive sin ID puede haber creado el archivo: no liberar quota a ciegas.
      throw error
    }
  } catch (error) { return publicFailure(error) }
}
