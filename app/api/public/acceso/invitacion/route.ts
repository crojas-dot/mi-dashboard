import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'
import { readAccessJson, AccessError } from '@/lib/server/accessService'

export const runtime = 'nodejs'
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
export async function POST(request: NextRequest) {
  if (!rateLimit(getClientIp(request), 10, 15 * 60_000, 'access-invite')) return json({ error: 'Esperá unos minutos antes de volver a intentarlo.' }, 429)
  try {
    // El enlace se confirma con POST para que un escáner de correo no lo consuma.
    const origin = request.headers.get('origin'), expected = new URL(process.env.PUBLIC_TRACKING_ORIGIN ?? '').origin
    if (origin !== expected && !(process.env.NODE_ENV !== 'production' && origin === new URL(request.url).origin)) return json({ error: 'Solicitud no válida.' }, 403)
    if (Number(request.headers.get('content-length')) > 256) return json({ error: 'Solicitud no válida.' }, 400)
    const body = await readAccessJson(request, 256)
    if (!body || typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token) || Object.keys(body).length !== 1) return json({ error: 'Invitación no disponible.' }, 400)
    const admin = createServiceClient(); if (!admin) return json({ error: 'Servicio no disponible.' }, 503)
    const { data, error } = await admin.rpc('qms_redeem_access_invitation', { p_digest: createHash('sha256').update(body.token).digest('hex') })
    if (error || !data) return json({ error: 'La invitación venció o ya fue utilizada. Pedí al administrador que la reenvíe.' }, 410)
    // Recovery requiere una cuenta existente; magiclink podría crear una cuenta
    // huérfana si un administrador elimina Auth durante el canje de la invitación.
    const generated = await admin.auth.admin.generateLink({ type: 'recovery', email: data.email })
    if (generated.error || generated.data.user.id !== data.authId) return json({ error: 'No se pudo abrir el acceso. Solicitá una nueva invitación.' }, 503)
    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const verified = await auth.auth.verifyOtp({ token_hash: generated.data.properties.hashed_token, type: 'recovery' })
    if (verified.error || verified.data.user?.id !== data.authId || !verified.data.session) return json({ error: 'No se pudo abrir el acceso. Solicitá una nueva invitación.' }, 503)
    return json({ session: { access_token: verified.data.session.access_token, refresh_token: verified.data.session.refresh_token } })
  } catch (error) { return json({ error: 'No se pudo verificar la invitación.' }, error instanceof AccessError ? error.status : 503) }
}
