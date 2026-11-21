import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'
import { getAccessIdentity } from '@/lib/server/accessIdentity'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { accessCommand, accessDirectory, accessUuid, inviteAccess, resetUserAccess, AccessError, readAccessJson } from '@/lib/server/accessService'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
export async function POST(request: NextRequest) {
  if (!rateLimit(getClientIp(request), 10, 60_000, 'users-access')) return json({ error: 'Esperá un minuto antes de continuar.' }, 429)
  const current = await getCurrentUser(request, request.signal)
  if (!current) return json({ error: 'No autorizado' }, 401)
  if (current.rol !== 'admin') return json({ error: 'Solo administradores' }, 403)
  const identity = await getAccessIdentity(request), admin = createServiceClient()
  if (!identity || !admin) return json({ error: 'Servicio no disponible' }, 503)
  try {
    const body = await readAccessJson(request, 512)
    if (!accessUuid(body.authId) || typeof body.action !== 'string' || !['resend', 'reset', 'reset_mfa', 'manual'].includes(body.action) || Object.keys(body).some(key => !['action', 'authId', 'confirm'].includes(key))) return json({ error: 'Solicitud inválida' }, 400)
    if (body.confirm !== true || body.authId === identity.id) return json({ error: 'La confirmación de otro administrador es obligatoria.' }, 400)
    if (body.action === 'manual') {
      const directory = await accessDirectory(admin, identity, [body.authId])
      const policy = directory.find(item => item.authId === body.authId)
      if (!policy || policy.status === 'disabled' || policy.status === 'invite_pending' || policy.status === 'invite_expired') throw new AccessError('40001', 409)
      // La contraseña cambia bajo la política existente, pero nunca se remite al emisor.
      const result = await resetUserAccess(admin, identity, body.authId, 'reset', false)
      if (!('tempPassword' in result) || typeof result.tempPassword !== 'string') throw new AccessError('unconfirmed_reset', 503)
      return json({ ok: true, accessDelivery: 'not_sent', tempPassword: result.tempPassword })
    }
    if (body.action === 'resend' || body.action === 'reset') {
      if (body.action === 'resend') {
        const directory = await accessDirectory(admin, identity, [body.authId])
        const policy = directory.find(item => item.authId === body.authId)
        if (!policy) throw new AccessError('40001', 409)
        if (policy.status === 'invite_pending' || policy.status === 'invite_expired') {
          const delivery = await inviteAccess(admin, identity, body.authId, new URL(request.url).origin)
          return json({ ok: true, invitation: delivery.outcome, accessDelivery: delivery.outcome, accessDeliveryError: delivery.reason })
        }
        if (!policy.temporaryPassword) throw new AccessError('40001', 409)
      }
      const delivery = await resetUserAccess(admin, identity, body.authId, body.action)
      // La contraseña ya cambió aunque el servicio de correo no confirme el envío.
      return json({ ok: true, accessDelivery: delivery.outcome, accessDeliveryError: delivery.reason })
    }
    // Compatibilidad con la recuperación de 2FA de las cuentas ya inscritas.
    await accessCommand(admin, identity, 'reset_begin', { authId: body.authId })
    const factors = await admin.auth.admin.mfa.listFactors({ userId: body.authId })
    if (factors.error) throw new AccessError('unavailable', 503)
    for (const factor of factors.data.factors) {
      const result = await admin.auth.admin.mfa.deleteFactor({ userId: body.authId, id: factor.id })
      if (result.error) throw new AccessError('unavailable', 503)
    }
    await accessCommand(admin, identity, 'reset_finish', { authId: body.authId })
    return json({ ok: true })
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 503
    const message = status === 429 ? 'Esperá un minuto antes de continuar.'
      : status === 409 ? 'El acceso cambió o hay una operación en curso. Volvé a abrir el usuario e intentá de nuevo.'
        : 'No se pudo confirmar la operación de acceso.'
    return json({ error: message }, status)
  }
}
