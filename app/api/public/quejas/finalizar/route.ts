import { getPublicFormsConfig } from '@/lib/server/publicForms/config'
import { readPublicJson } from '@/lib/server/publicForms/bodies'
import { validatePublicFinalization } from '@/lib/server/publicForms/validation'
import { verifyUploadCapability } from '@/lib/server/publicForms/uploadCapability'
import { verifyPublicBot } from '@/lib/server/publicForms/botProtection'
import { publicBackend, publicRpc, publicReply, publicFailure } from '@/lib/server/publicForms/gateway'
import { trackingEnabled, trackingLinkForCase } from '@/lib/server/publicTracking'
import { logger } from '@/lib/utils/logger'
import { after } from 'next/server'
import { wakeQuejaMail } from '@/lib/server/quejaMailWake'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { signingSecret } = getPublicFormsConfig()
    await verifyPublicBot(request)
    const claims = verifyUploadCapability(validatePublicFinalization(await readPublicJson(request)), signingSecret)
    const client = publicBackend()
    const result = await publicRpc<Record<string, unknown>>(client, 'public_form_finalize_submission', { p_form_id: claims.formId, p_submission_id: claims.submissionId, p_queja_id: claims.quejaId })
    // Solo tras confirmar registro/adjuntos; la respuesta del formulario no espera a MailApp.
    try { after(async () => { await wakeQuejaMail() }) }
    catch { logger.warn('El registro se confirmó; el emisor periódico conserva el aviso', { module: 'quejas_mail', action: 'schedule_wake', code: 'wake_unavailable' }) }
    let trackingUrl: string | null = null
    let trackingState: 'disabled' | 'available' | 'pending' = 'disabled'
    if (trackingEnabled()) {
      // El registro ya hizo commit: un enlace temporalmente indisponible no convierte el envío en fallo.
      try {
        trackingUrl = await trackingLinkForCase(client, claims.quejaId)
        trackingState = 'available'
      } catch {
        trackingState = 'pending'
        logger.warn('No se pudo preparar el enlace de seguimiento', { module: 'public_tracking', action: 'finalize_link', code: 'tracking_link_pending' })
      }
    }
    return publicReply({ ...result, trackingState, ...(trackingUrl ? { trackingUrl } : {}) })
  } catch (error) { return publicFailure(error) }
}
