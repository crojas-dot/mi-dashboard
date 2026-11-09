import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { quejaMailConfig } from '@/lib/server/quejaMailConfig'
import { dispatchQuejaMail } from '@/lib/server/quejaMailWorker'
import { mailRecord, QuejaMailProtocolError, readMailJson, signMailEnvelope, verifyMailEnvelope } from '@/lib/server/quejaMailProtocol'

export const runtime = 'nodejs'
export const maxDuration = 60
const response = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { 'Cache-Control': 'no-store' },
})

export async function POST(request: NextRequest) {
  const config = quejaMailConfig()
  if (!config) return response({ error: 'mail_worker_disabled' }, 503)
  let authenticated: ReturnType<typeof verifyMailEnvelope>
  let limit: number
  try {
    authenticated = verifyMailEnvelope(await readMailJson(request), 'worker_request', config.secret)
    const payload = mailRecord(authenticated.payload, ['action', 'limit'])
    if (payload.action !== 'dispatch' || !Number.isInteger(payload.limit) || Number(payload.limit) < 1 || Number(payload.limit) > 5) {
      throw new QuejaMailProtocolError()
    }
    limit = Number(payload.limit)
  } catch (error) {
    if (error instanceof QuejaMailProtocolError && error.code === 'mail_body_too_large') {
      return response({ error: error.code }, 413)
    }
    return response({ error: 'invalid_mail_worker_request' }, 401)
  }
  // El emisor es un worker autenticado por HMAC, no un usuario ni una solicitud del formulario.
  // El destinatario, tipo y contenido provienen exclusivamente de snapshots congelados en DB.
  const admin = createServiceClient(AbortSignal.timeout(50_000))
  if (!admin) return response({ error: 'mail_worker_unavailable' }, 503)
  try {
    const counts = await dispatchQuejaMail(admin, config, { limit,
      nonce: authenticated.envelope.nonce, issuedAt: authenticated.envelope.issuedAt })
    return response(signMailEnvelope('worker_receipt', {
      requestNonce: authenticated.envelope.nonce, ...counts,
    }, config.secret))
  } catch {
    // Mensajes externos pueden incluir PII. El worker responde solo un código fijo.
    return response({ error: 'mail_worker_unavailable' }, 503)
  }
}
