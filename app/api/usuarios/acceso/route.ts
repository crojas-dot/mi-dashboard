import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'
import { getAccessIdentity } from '@/lib/server/accessIdentity'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { accessCommand, accessUuid, inviteAccess, AccessError, readAccessJson } from '@/lib/server/accessService'
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
    if (!accessUuid(body.authId) || typeof body.action !== 'string' || !['resend', 'reset_mfa'].includes(body.action) || Object.keys(body).some(key => !['action', 'authId', 'confirm'].includes(key))) return json({ error: 'Solicitud inválida' }, 400)
    if (body.action === 'resend') {
      const delivery = await inviteAccess(admin, identity, body.authId,new URL(request.url).origin)
      return json({ ok: delivery === 'sent', delivery }, delivery === 'sent' ? 200 : 502)
    }
    if (body.confirm !== true || body.authId === identity.id) return json({ error: 'La confirmación de otro administrador es obligatoria.' }, 400)
    await accessCommand(admin, identity, 'reset_begin', { authId: body.authId })
    const factors = await admin.auth.admin.mfa.listFactors({ userId: body.authId })
    if (factors.error) throw new AccessError('unavailable', 503)
    for (const factor of factors.data.factors) {
      const result = await admin.auth.admin.mfa.deleteFactor({ userId: body.authId, id: factor.id })
      if (result.error) throw new AccessError('unavailable', 503)
    }
    await accessCommand(admin, identity, 'reset_finish', { authId: body.authId })
    return json({ ok: true })
  } catch (error) { return json({ error: error instanceof AccessError && error.status === 429 ? 'Esperá un minuto antes de reenviar la invitación.' : 'No se pudo completar la operación. La cuenta conserva su protección.' }, error instanceof AccessError ? error.status : 503) }
}
