import { NextResponse, type NextRequest } from 'next/server'
import { createAuthenticatedClient, getCurrentUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { rateLimit } from '@/lib/server/rateLimit'
import { quejaMailCanRetry } from '@/lib/utils/quejaMailStatus'

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const fail = (error: string, status: number) => reply({ error }, status)

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request, request.signal)
    if (!user) return fail('Sesión no válida.', 401)
    if (user.rol !== 'admin' && user.rol !== 'calidad') return fail('Solo Gestión de Calidad puede reintentar correos.', 403)
    if (!rateLimit(user.id, 10, 60_000, 'queja-mail-retry')) return fail('Esperá un minuto antes de reintentar otro envío.', 429)
    const { searchParams } = request.nextUrl
    const quejaId = searchParams.get('quejaId')
    const eventId = searchParams.get('eventId')
    if (!quejaId || !eventId || !uuid.test(quejaId) || !uuid.test(eventId)) return fail('Expediente o correo no válido.', 400)
    const client = createAuthenticatedClient(request, request.signal)
    if (!client) return fail('Sesión no válida.', 401)
    if (user.rol !== 'admin') {
      const { data, error } = await client.rpc('app_tiene_permiso', { p_modulo: 'quejas', p_requiere_escribir: true })
      if (error) return fail('No se pudo comprobar el permiso para reintentar correos.', 503)
      if (data !== true) return fail('Tu cuenta no tiene permiso de escritura en Quejas.', 403)
    }
    const { data: expediente, error: caseError } = await client.from('quejas').select('id').eq('id', quejaId).maybeSingle()
    if (caseError) return fail('No se pudo consultar el expediente.', 503)
    if (!expediente) return fail('Expediente no disponible.', 404)
    const { data: mail, error } = await client.from('queja_mail_outbox').select('status,safe_error,attempts,sent_at,updated_at')
      .eq('queja_id', quejaId).eq('id', eventId).maybeSingle()
    if (error) return fail('No se pudo consultar el estado del correo.', 503)
    if (!mail) return fail('Correo no disponible.', 404)
    if (!quejaMailCanRetry(mail)) return fail('El estado actual del correo no permite reintentar el envío.', 409)

    const admin = createServiceClient(request.signal)
    if (!admin) return fail('La cola de correo no está disponible.', 503)
    const now = new Date().toISOString()
    // El poll recoge el mismo evento. El CAS y el diario del emisor evitan otro
    // envío si el worker ya procesó el correo o tomó la reserva mientras tanto.
    const { data: queued, error: updateError } = await admin.from('queja_mail_outbox').update({
      status: 'pending', next_attempt_at: now, updated_at: now,
      ...(mail.status === 'failed' || mail.attempts >= 12 ? { attempts: 0 } : {}),
    }).eq('queja_id', quejaId).eq('id', eventId).eq('status', mail.status).eq('updated_at', mail.updated_at)
      .is('sent_at', null).is('claim_token', null).is('lease_until', null).select('id').maybeSingle()
    if (updateError) return fail('No se pudo confirmar el reintento en la cola de correo.', 503)
    if (!queued) return fail('El estado del correo cambió. Actualizá antes de reintentar.', 409)
    return reply({ queued: true })
  } catch { return fail('No se pudo confirmar el reintento de envío.', 503) }
}
