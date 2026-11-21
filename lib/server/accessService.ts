import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccessIdentity } from '@/lib/server/accessIdentity'
import type { AccessStatus, UserAccessDirectory, UserAccessSetup, UserMutationResult } from '@/lib/types/access'
import { generatePassword } from '@/lib/services/passwordGenerator'
import { isAccessMailCode, type AccessMailCode, type AccessMailOutcome } from '@/supabase/functions/_shared/accessMailResult'
import { streamToBuffer } from '@/lib/server/uploadHelpers'

export const accessUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
type SessionIdentity = Pick<AccessIdentity, 'id' | 'sessionId' | 'aal'>
export class AccessError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code) }
}
export async function readAccessJson(request: Request, maximum = 4096): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || !request.body) throw new AccessError('invalid', 400)
  try {
    const bytes = await streamToBuffer(request.body, maximum)
    const value = JSON.parse(bytes.toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value
  } catch { throw new AccessError('invalid', 400) }
}
export async function setOwnAccessPassword(identity: AccessIdentity, password: string, operationId?: string) {
  // PUT /user conserva la sesión actual; el reset administrativo la revocaría
  // antes de poder confirmar el cambio obligatorio en nuestra política.
  const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/user', {
    method: 'PUT', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, ...(operationId ? { data: { qms_password_operation: operationId } } : {}) }),
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    if (result?.code === 'same_password') throw new AccessError('same_password')
    if (response.status >= 500) throw new AccessError('unavailable', 503)
    throw new AccessError('invalid_password')
  }
  const user = await response.json()
  if (user.id !== identity.id) throw new AccessError('unauthorized', 403)
}
async function runAccessCommand<T>(admin: SupabaseClient, identity: SessionIdentity,
  rpc: 'qms_access_command' | 'qms_temporary_access_command', action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(rpc, {
    p_action: action, p_user: identity.id, p_session: identity.sessionId, p_aal: identity.aal, p_data: payload,
  })
  if (error) throw new AccessError(error.code ?? 'unavailable', error.code === '42501' ? 403 : error.code === 'P0429' ? 429 : error.code === '40001' || error.code === '23505' ? 409 : 503)
  if (data?.error) throw new AccessError(data.error, ['locked', 'rate_limited'].includes(data.error) ? 429 : 400)
  return data as T
}
export function accessCommand<T = Record<string, unknown>>(admin: SupabaseClient, identity: SessionIdentity, action: string, payload: Record<string, unknown> = {}) {
  return runAccessCommand<T>(admin, identity, 'qms_access_command', action, payload)
}
function temporaryAccessCommand<T = Record<string, unknown>>(admin: SupabaseClient, identity: SessionIdentity, action: string, payload: Record<string, unknown> = {}) {
  return runAccessCommand<T>(admin, identity, 'qms_temporary_access_command', action, payload)
}

export async function accessDirectory(admin: SupabaseClient, identity: SessionIdentity, ids: string[]) {
  try { return await temporaryAccessCommand<UserAccessDirectory[]>(admin, identity, 'directory', { ids }) }
  catch (error) {
    if (!(error instanceof AccessError) || !['PGRST202', '42883'].includes(error.code)) throw error
    return accessCommand<UserAccessDirectory[]>(admin, identity, 'directory', { ids })
  }
}
export async function accessStatus(admin: SupabaseClient, identity: Pick<AccessIdentity, 'id' | 'sessionId' | 'aal'>): Promise<AccessStatus> {
  try { return await accessCommand<AccessStatus>(admin, identity, 'status') }
  catch (error) {
    // Compatibilidad de lectura antes de aplicar la migración; crear con política
    // nueva siempre exige el RPC y falla antes de crear Auth si todavía falta.
    if (error instanceof AccessError && ['PGRST202', '42883'].includes(error.code)) {
      const { data, error: profileError } = await admin.from('usuarios').select('estado').eq('auth_id', identity.id).maybeSingle()
      if (profileError) throw new AccessError('unavailable', 503)
      return { managed: false, phase: data?.estado === 'activo' ? 'ready' : 'blocked' }
    }
    throw error
  }
}
const accessMailReasons: Record<AccessMailCode, string> = {
  disabled: 'El envío de correos de acceso está desactivado.',
  ledger_busy: 'El emisor de correos está ocupado.',
  quota_exhausted: 'Google agotó la cuota diaria de correo.',
  event_conflict: 'El correo de acceso no coincide con el envío registrado.',
  access_mail_unavailable: 'El servicio de correo de acceso no está disponible.',
  delivery_uncertain: 'El emisor no confirmó si el correo fue enviado.',
}

export async function sendAccessMessage(admin: SupabaseClient, message: Record<string, unknown>): Promise<{ outcome: AccessMailOutcome; reason?: string }> {
  try {
    const { data, error } = await admin.functions.invoke('qms-access-mailer', { body: message })
    const result = error?.context instanceof Response ? await error.context.json().catch(() => null) : data
    if (result?.outcome === 'sent') return { outcome: 'sent' }
    if (result && (result.outcome === 'failed' || result.outcome === 'uncertain')) {
      const code: unknown = result.code
      return { outcome: result.outcome, reason: isAccessMailCode(code) ? accessMailReasons[code]
        : result.outcome === 'uncertain' ? accessMailReasons.delivery_uncertain : accessMailReasons.access_mail_unavailable }
    }
  } catch { /* Una respuesta de transporte perdida no confirma el envío. */ }
  return { outcome: 'uncertain', reason: accessMailReasons.delivery_uncertain }
}
function accessOrigin(requestOrigin?: string) {
  // Solo desarrollo local puede generar enlaces de loopback. Producción usa el origen configurado.
  if (process.env.NODE_ENV === 'development' && ['http://localhost:3000', 'http://127.0.0.1:3000'].includes(requestOrigin ?? '')) {
    return { origin: requestOrigin!, local: true }
  }
  let url: URL
  try {
    url = new URL(process.env.PUBLIC_TRACKING_ORIGIN ?? '')
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error()
  } catch { throw new AccessError('configuration', 503) }
  return { origin: url.origin, local: false }
}

export async function inviteAccess(admin: SupabaseClient, identity: SessionIdentity, authId: string, requestOrigin?: string) {
  const { origin, local } = accessOrigin(requestOrigin)
  const token = randomBytes(32).toString('base64url')
  const eventId = randomUUID()
  // El vínculo no se conserva en DB: únicamente su digest SHA-256. Reenviar invalida el anterior.
  const { email } = await accessCommand<{ email: string }>(admin, identity, 'invite', {
    authId, id: eventId, digest: createHash('sha256').update(token).digest('hex'),
  })
  const delivery = await sendAccessMessage(admin, {
    eventId, kind: 'invitation', to: email, url: origin + '/acceso#invitacion=' + token,
    ...(local ? { local: true } : {}),
  })
  try {
    await accessCommand(admin, identity, 'invite_result', { authId, id: eventId, delivery: delivery.outcome })
  } catch {
    // Nunca reenviar automáticamente cuando el proveedor pudo haber aceptado el correo.
    return { outcome: 'uncertain' as const, reason: 'El resultado de la invitación no se pudo registrar. Revisá la entrega antes de reenviar.' }
  }
  return delivery
}

async function sendTemporaryAccess(admin: SupabaseClient, eventId: string, name: string, email: string, password: string) {
  let origin: string
  try { origin = accessOrigin().origin }
  catch { return { outcome: 'failed' as const, reason: 'El enlace oficial de ingreso no está configurado.' } }
  return sendAccessMessage(admin, { eventId, kind: 'temporary_access', to: email, name, password, url: origin + '/login' })
}

export async function createUserWithAccess(admin: SupabaseClient, identity: SessionIdentity,
  input: { nombre: string; email: string; rol: string; estado: string }, setup: UserAccessSetup, requestOrigin?: string): Promise<UserMutationResult> {
  if (setup.invite) accessOrigin(requestOrigin) // Validar URL antes de reservar Auth y perfil.
  const payload = { ...input, ...setup, ...(setup.invite ? {} : { temporaryAccess: true }) }
  const reservation = setup.invite
    ? await accessCommand<{ completed: boolean; authId: string | null }>(admin, identity, 'create_begin', payload)
    : await temporaryAccessCommand<{ id: string; completed: boolean; authId: string | null; leaseUntil: string }>(admin, identity, 'create_begin', payload)
  const existing = reservation.authId
  if (reservation.completed) {
    if (!existing) throw new AccessError('40001', 409)
    // La operación ya creó la cuenta; el botón de reenvío gestiona el correo aparte.
    return { ok: true, created: true, userId: existing, accessDelivery: 'not_sent',
      ...(setup.invite ? { invitation: 'not_sent' as const } : {}) }
  }
  const password = generatePassword(24)
  let authId: string
  if (existing) {
    if (!setup.invite) {
      // Una creación temporal interrumpida siempre emite otra credencial segura.
      const { error } = await admin.auth.admin.updateUserById(existing, { password })
      if (error) throw new AccessError('create_auth', 503)
    }
    authId = existing
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email, password, email_confirm: true,
      user_metadata: { nombre: input.nombre }, app_metadata: { qms_creation_id: setup.id },
    })
    if (error || !data.user) throw new AccessError('create_auth', error?.status && error.status < 500 ? 409 : 503)
    authId = data.user.id
  }
  const created = { ok: true, created: true, userId: authId } as const
  if (setup.invite) {
    await accessCommand(admin, identity, 'create_commit', { id: setup.id, authId })
    let delivery: Awaited<ReturnType<typeof inviteAccess>>
    try { delivery = await inviteAccess(admin, identity, authId, requestOrigin) }
    catch {
      // Nunca eliminar una cuenta confirmada aunque no se pueda preparar o entregar el email.
      delivery = { outcome: 'failed', reason: 'No se pudo preparar la invitación. Podés reenviarla desde este usuario.' }
    }
    return { ...created, invitation: delivery.outcome, accessDelivery: delivery.outcome, accessDeliveryError: delivery.reason }
  }
  if (!('id' in reservation) || typeof reservation.id !== 'string'
    || !('leaseUntil' in reservation) || typeof reservation.leaseUntil !== 'string') throw new AccessError('40001', 409)
  const { issued } = await temporaryAccessCommand<{ issued: boolean }>(admin, identity, 'create_commit', {
    id: reservation.id, authId, leaseUntil: reservation.leaseUntil,
  })
  if (!issued) return { ...created, accessDelivery: 'not_sent' }
  const delivery = await sendTemporaryAccess(admin, reservation.id, input.nombre, input.email, password)
  return { ...created, accessDelivery: delivery.outcome, accessDeliveryError: delivery.reason }
}

export async function resetUserAccess(admin: SupabaseClient, identity: SessionIdentity, authId: string, action: 'resend' | 'reset') {
  const operation = await temporaryAccessCommand<{ id: string; email: string; name: string }>(admin, identity, action, { authId })
  const password = generatePassword(24)
  try {
    const { error } = await admin.auth.admin.updateUserById(authId, { password, app_metadata: { qms_password_operation: operation.id } })
    if (error) throw new AccessError('unavailable', 503)
  } catch {
    await temporaryAccessCommand(admin, identity, 'reset_release', { authId, id: operation.id }).catch(() => undefined)
    throw new AccessError('unconfirmed_reset', 503)
  }
  return sendTemporaryAccess(admin, operation.id, operation.name, operation.email, password)
}

export async function changeTemporaryAccessPassword(admin: SupabaseClient, identity: AccessIdentity, password: string) {
  if (!identity.passwordAuthenticated) throw new AccessError('password_login_required', 403)
  const { id } = await temporaryAccessCommand<{ id: string }>(admin, identity, 'change_begin')
  try {
    await setOwnAccessPassword(identity, password, id)
  } catch (error) {
    await temporaryAccessCommand(admin, identity, 'change_release', { id }).catch(() => undefined)
    const status = await accessStatus(admin, identity).catch(() => null)
    if (status && !status.temporaryPassword && status.phase !== 'blocked') return status
    throw error
  }
  return accessStatus(admin, identity)
}
