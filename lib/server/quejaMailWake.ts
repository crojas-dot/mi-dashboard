import 'server-only'
import { googleReply } from '@/lib/server/quejaMailTransport'
import { mailRecord, signMailEnvelope, verifyMailEnvelope } from '@/lib/server/quejaMailProtocol'
import { logger } from '@/lib/utils/logger'

export function quejaMailWakeConfig(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.QUEJAS_MAIL_WAKE_ENABLED !== 'true') return null
  const secret = environment.QUEJAS_MAIL_WAKE_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return null
  let url: URL
  try { url = new URL(environment.QUEJAS_MAIL_WAKE_URL ?? '') } catch { return null }
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port || url.username || url.password
    || url.search || url.hash || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) return null
  return { url: url.toString(), secret }
}

/** Solo despierta al emisor existente: sin destinatarios, contenido, claims ni ACK desde Next. */
export async function wakeQuejaMail(options: { environment?: NodeJS.ProcessEnv; fetcher?: typeof fetch } = {}) {
  const config = quejaMailWakeConfig(options.environment)
  if (!config) return false
  try {
    const request = signMailEnvelope('queue_wake_request', {}, config.secret)
    const response = await googleReply(config.url, JSON.stringify(request), AbortSignal.timeout(15_000), options.fetcher ?? fetch)
    const { payload } = verifyMailEnvelope(response, 'queue_wake_receipt', config.secret)
    const receipt = mailRecord(payload, ['requestNonce', 'status'])
    if (receipt.requestNonce !== request.nonce || !['accepted', 'busy', 'disabled'].includes(String(receipt.status))) throw new Error('invalid_wake_receipt')
    return receipt.status === 'accepted'
  } catch {
    // La cola y su emisor conservan la entrega incierta. No repetir un POST perdido.
    logger.warn('No se pudo activar el envío inmediato; la cola conserva el aviso', { module: 'quejas_mail', action: 'wake', code: 'wake_unavailable' })
    return false
  }
}
