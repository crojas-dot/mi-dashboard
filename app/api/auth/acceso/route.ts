import { NextRequest, NextResponse } from 'next/server'
import { getAccessIdentity } from '@/lib/server/accessIdentity'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { accessCommand, accessStatus, accessUuid, AccessError, sendAccessMessage, readAccessJson, setOwnAccessPassword } from '@/lib/server/accessService'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
function failure(error: unknown) {
  const code = error instanceof AccessError ? error.code : 'unavailable'
  const messages:Record<string,string>={
    locked:'Demasiados intentos fallidos. Por seguridad, esperá unos minutos antes de volver a intentarlo.',
    rate_limited:'Esperá un minuto antes de solicitar otro código.',
    invalid_code:'El código no es válido o ya venció. Intentá nuevamente.',
    delivery_failed:'No se pudo confirmar el envío del código. Solicitá uno nuevo en un minuto.',
    invalid_password:'Elegí una contraseña nueva de al menos 12 caracteres.',
    '22023':'Revisá los datos. El correo alternativo debe ser distinto al de tu cuenta.',
    '40001':'El acceso cambió. Actualizá e intentá nuevamente.',
  }
  const message=messages[code]??'No se pudo completar la verificación. Intentá nuevamente.'
  return json({ error: message, code }, error instanceof AccessError ? error.status : 503)
}
async function context(request: NextRequest) {
  if (!rateLimit(getClientIp(request), 40, 60_000, 'access')) throw new AccessError('rate_limited', 429)
  const identity = await getAccessIdentity(request)
  if (!identity) throw new AccessError('unauthorized', 401)
  const admin = createServiceClient()
  if (!admin) throw new AccessError('configuration', 503)
  const status = await accessStatus(admin, identity)
  if (status.phase === 'blocked') throw new AccessError('unauthorized', 403)
  return { identity, admin, status }
}
export async function GET(request: NextRequest) {
  try { return json((await context(request)).status) } catch (error) { return failure(error) }
}
export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get('content-length')) > 4096) throw new AccessError('invalid', 400)
    const { identity, admin, status } = await context(request)
    const body = await readAccessJson(request)
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['action', 'password', 'email', 'code', 'id'].includes(k))) throw new AccessError('invalid', 400)
    if (body.action === 'password') {
      if (status.phase !== 'password' || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new AccessError('invalid_password', 400)
      await setOwnAccessPassword(identity, body.password)
      return json(await accessCommand(admin, identity, 'password_done'))
    }
    if (!['enroll', 'verify'].includes(status.phase)) throw new AccessError(status.phase === 'locked' ? 'locked' : 'unavailable', status.phase === 'locked' ? 429 : 403)
    if (body.action === 'email_send') {
      if (body.email !== undefined && (typeof body.email !== 'string' || body.email.length > 254)) throw new AccessError('invalid', 400)
      const challenge = await accessCommand<{ id: string; code: string; email: string; maskedEmail: string }>(admin, identity, 'email_send', { email: body.email })
      const delivery = await sendAccessMessage(admin, { eventId: challenge.id, kind: 'email_otp', to: challenge.email, code: challenge.code })
      await accessCommand(admin, identity, 'email_sent', { id: challenge.id, sent: delivery === 'sent' })
      if (delivery !== 'sent') throw new AccessError('delivery_failed', 503)
      return json({ id: challenge.id, maskedEmail: challenge.maskedEmail })
    }
    if (body.action === 'email_verify') {
      if (!accessUuid(body.id) || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new AccessError('invalid_code', 400)
      return json(await accessCommand(admin, identity, 'email_verify', { id: body.id, code: body.code }))
    }
    if (body.action === 'totp_start') {
      if (status.method === 'email') throw new AccessError('unavailable', 403)
      const factors = await identity.client.auth.mfa.listFactors()
      if (factors.error) throw new AccessError('unavailable', 503)
      let factorId = factors.data.totp.find(f => f.status === 'verified')?.id
      let qrCode: string | undefined, secret: string | undefined
      if (!factorId) {
        for (const pending of factors.data.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) {
          const result = await identity.client.auth.mfa.unenroll({ factorId: pending.id }); if (result.error) throw new AccessError('unavailable', 503)
        }
        const enrolled = await identity.client.auth.mfa.enroll({ factorType: 'totp', issuer: 'ECA-QMS', friendlyName: 'ECA-QMS' })
        if (enrolled.error) throw new AccessError('unavailable', 503)
        factorId = enrolled.data.id
        qrCode = enrolled.data.totp.qr_code; secret = enrolled.data.totp.secret
      }
      const challenge = await identity.client.auth.mfa.challenge({ factorId })
      if (challenge.error) throw new AccessError('unavailable', 503)
      const id = randomUUID()
      await accessCommand(admin, identity, 'totp_bind', { id, factorId, nativeId: challenge.data.id })
      return json({ id, qrCode, secret })
    }
    if (body.action === 'totp_verify') {
      if (!accessUuid(body.id) || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new AccessError('invalid_code', 400)
      const attempt = await accessCommand<{ lease: string; factorId: string; nativeId: string }>(admin, identity, 'totp_attempt', { id: body.id })
      const result = await identity.client.auth.mfa.verify({ factorId: attempt.factorId, challengeId: attempt.nativeId, code: body.code })
      let aal = 'aal1'
      if (!result.error) {
        const verified = await identity.client.auth.getClaims(result.data.access_token)
        if (verified.error || verified.data?.claims.sub !== identity.id || verified.data.claims.session_id !== identity.sessionId) throw new AccessError('unauthorized', 403)
        aal = String(verified.data.claims.aal)
      }
      const next = await accessCommand(admin, { ...identity, aal }, 'totp_finish', { id: body.id, lease: attempt.lease, valid: !result.error })
      if (result.error) throw new AccessError('invalid_code', 400)
      // Se entregan únicamente a su titular; no se registran tokens ni códigos.
      return json({ status: next, session: { access_token: result.data.access_token, refresh_token: result.data.refresh_token } })
    }
    throw new AccessError('invalid', 400)
  } catch (error) { return failure(error) }
}
