import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { googleReply } from '@/lib/server/quejaMailTransport'
import type { QuejaMailConfig } from '@/lib/server/quejaMailConfig'
import { claimMailSnapshot, quejaMailMessage, type QuejaMailSnapshot } from '@/supabase/functions/quejas-mail-queue/message'
export { quejaMailMessage } from '@/supabase/functions/quejas-mail-queue/message'
import { isMailUuid, mailRecord, QuejaMailProtocolError, signMailEnvelope, verifyMailEnvelope } from '@/lib/server/quejaMailProtocol'

type MailOutcome = 'sent' | 'retry' | 'uncertain' | 'failed'
type ClaimedMail = QuejaMailSnapshot
interface DeliveryReceipt { outcome: MailOutcome; code: string; retryAfterSeconds: number }
const RECEIPT_CODES = ['sent', 'already_sent', 'quota_exhausted', 'ledger_busy', 'ledger_unavailable',
  'delivery_uncertain', 'event_conflict', 'invalid_delivery', 'disabled']
const claimedMail = claimMailSnapshot


async function deliver(row: ClaimedMail, config: QuejaMailConfig, signal: AbortSignal, fetcher: typeof fetch): Promise<DeliveryReceipt> {
  const envelope = signMailEnvelope('delivery_request', quejaMailMessage(row), config.secret)
  try {
    const response = await googleReply(config.webAppUrl, JSON.stringify(envelope), signal, fetcher)
    const { payload } = verifyMailEnvelope(response, 'delivery_receipt', config.secret)
    const receipt = mailRecord(payload, ['eventId', 'requestNonce', 'outcome', 'code', 'retryAfterSeconds'])
    if (receipt.eventId !== row.id || receipt.requestNonce !== envelope.nonce
      || !['sent', 'retry', 'uncertain', 'failed'].includes(String(receipt.outcome))
      || !RECEIPT_CODES.includes(String(receipt.code))) throw new QuejaMailProtocolError('invalid_mail_receipt')
    const retryAfterSeconds = receipt.retryAfterSeconds === undefined ? 300 : Number(receipt.retryAfterSeconds)
    if (!Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 30 || retryAfterSeconds > 86_400) {
      throw new QuejaMailProtocolError('invalid_mail_receipt')
    }
    return { outcome: receipt.outcome as MailOutcome, code: receipt.code as string, retryAfterSeconds }
  } catch {
    // Un timeout o una respuesta perdida pueden ocurrir después de MailApp.sendEmail.
    // Guardar incertidumbre, sin reintentar a ciegas ni registrar destinatarios/body/errores externos.
    return { outcome: 'uncertain', code: 'delivery_uncertain', retryAfterSeconds: 300 }
  }
}

export async function dispatchQuejaMail(admin: SupabaseClient, config: QuejaMailConfig,
  run: { limit: number; nonce: string; issuedAt: number }, options: { fetcher?: typeof fetch; now?: () => number } = {}) {
  const now = options.now ?? Date.now
  const deadline = now() + 45_000
  const { data, error } = await admin.rpc('qms_mail_claim_batch', {
    p_limit: run.limit, p_lease_seconds: 120, p_run_nonce: run.nonce, p_issued_at: run.issuedAt,
  })
  if (error || !Array.isArray(data) || data.length > run.limit) throw new Error('mail_claim_failed')
  const counts = { claimed: data.length, sent: 0, retry: 0, uncertain: 0, failed: 0 }
  for (const value of data) {
    const raw = mailRecord(value)
    if (!isMailUuid(raw.id) || !isMailUuid(raw.claim_token)) throw new Error('mail_claim_failed')
    let receipt: DeliveryReceipt
    try {
      const row = claimedMail(value)
      // El transporte legacy no tiene el preflight de destinatarios internos.
      // Sus dos avisos ciudadanos nunca deben ampliar ese alcance por accidente.
      if (!['recibido', 'final'].includes(row.tipo)) throw new Error('invalid_mail_snapshot')
      if (now() > deadline - 9_000) receipt = { outcome: 'retry', code: 'batch_not_started', retryAfterSeconds: 300 }
      else receipt = await deliver(row, config, AbortSignal.timeout(8_000), options.fetcher ?? fetch)
    } catch { receipt = { outcome: 'failed', code: 'invalid_mail_snapshot', retryAfterSeconds: 300 } }
    const result = await admin.rpc('qms_mail_complete', {
      p_id: raw.id, p_claim_token: raw.claim_token, p_outcome: receipt.outcome,
      p_retry_delay_seconds: receipt.retryAfterSeconds, p_safe_error: receipt.outcome === 'sent' ? null : receipt.code,
    })
    if (result.error || result.data !== true) throw new Error('mail_ack_failed')
    counts[receipt.outcome]++
  }
  return counts
}
