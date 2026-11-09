import { Readable } from 'node:stream'
import { publicTrackingRequest, trackingRpc, trackingFailure } from '@/lib/server/publicTracking'
import { PublicGatewayError } from '@/lib/server/publicForms/gateway'
import { getDriveClient, assertDriveCaseFile } from '@/lib/server/drive'
import { PublicFormsUnavailableError } from '@/lib/server/publicForms/config'
import { streamToBuffer } from '@/lib/server/uploadHelpers'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { client, claims, input } = await publicTrackingRequest(request, true)
    const value = await trackingRpc(client, 'qms_public_tracking_document', { p_queja_id: claims.quejaId, p_nonce: claims.nonce, p_adjunto_id: input.documentoId }) as Record<string, unknown> | null
    if (!value || (input.folio !== undefined && input.folio !== value.folio)) throw new PublicGatewayError(404, 'tracking_not_found')
    const { storage_path: fileId, nombre, folio, tamano } = value
    if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(fileId) || typeof nombre !== 'string' || nombre.length > 255 || typeof folio !== 'string'
      || typeof tamano !== 'number' || !Number.isSafeInteger(tamano) || tamano < 1 || tamano > 4 * 1024 * 1024) throw new PublicFormsUnavailableError()
    const { data, error } = await client.from('configuraciones_sistema').select('valor').eq('clave', 'drive_folder_id_quejas').maybeSingle()
    const drive = getDriveClient()
    if (error || !drive || typeof data?.valor !== 'string') throw new PublicFormsUnavailableError()
    await assertDriveCaseFile(drive, data.valor, fileId, folio)
    const result = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream', signal: request.signal })
    const stream = Readable.toWeb(result.data as Readable) as ReadableStream<Uint8Array>
    const bytes = await streamToBuffer(stream, 4 * 1024 * 1024)
    // Descarga forzada; documentos activos nunca se ejecutan en el origen de la aplicación.
    const ascii = nombre.replace(/[^\x20-\x7E]|["\\]/g, '_')
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
  } catch (error) { return trackingFailure(error) }
}
