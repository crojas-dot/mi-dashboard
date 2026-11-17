import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccessIdentity } from '@/lib/server/accessIdentity'
import type { AccessStatus, UserAccessSetup, UserMutationResult } from '@/lib/types/access'
import { generatePassword } from '@/lib/services/passwordGenerator'
import { streamToBuffer } from '@/lib/server/uploadHelpers'

export const accessUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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
export async function setOwnAccessPassword(identity: AccessIdentity, password: string) {
  // PUT /user conserva la sesión actual; el reset administrativo la revocaría
  // antes de poder confirmar el cambio obligatorio en nuestra política.
  const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/user', {
    method: 'PUT', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }), cache: 'no-store', signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new AccessError('invalid_password', 400)
  const user = await response.json()
  if (user.id !== identity.id) throw new AccessError('unauthorized', 403)
}
export async function accessCommand<T = Record<string, unknown>>(admin: SupabaseClient, identity: Pick<AccessIdentity, 'id' | 'sessionId' | 'aal'>,
  action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await admin.rpc('qms_access_command', {
    p_action: action, p_user: identity.id, p_session: identity.sessionId, p_aal: identity.aal, p_data: payload,
  })
  if (error) throw new AccessError(error.code ?? 'unavailable', error.code === '42501' ? 403 : error.code === 'P0429' ? 429 : error.code === '40001' || error.code === '23505' ? 409 : 503)
  if (data?.error) throw new AccessError(data.error, ['locked', 'rate_limited'].includes(data.error) ? 429 : 400)
  return data as T
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
export async function sendAccessMessage(admin: SupabaseClient, message: Record<string, unknown>) {
  const { data, error } = await admin.functions.invoke('qms-access-mailer', { body: message })
  if (error || !data || !['sent', 'uncertain', 'failed'].includes(data.outcome)) return 'failed' as const
  return data.outcome as 'sent' | 'uncertain' | 'failed'
}
function accessOrigin(requestOrigin?:string) {
  // Las invitaciones de desarrollo vuelven solo al loopback concreto; nunca se
  // acepta un host arbitrario del request ni un callback HTTP en producción.
  if(process.env.NODE_ENV==='development'&&['http://localhost:3000','http://127.0.0.1:3000'].includes(requestOrigin??'')) {
    return {origin:requestOrigin!,local:true}
  }
  const url = new URL(process.env.PUBLIC_TRACKING_ORIGIN ?? '')
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new AccessError('configuration', 503)
  return {origin:url.origin,local:false}
}
export async function inviteAccess(admin: SupabaseClient, identity: Pick<AccessIdentity, 'id' | 'sessionId' | 'aal'>, authId: string,requestOrigin?:string) {
  const {origin,local} = accessOrigin(requestOrigin), token = randomBytes(32).toString('base64url'), id = randomUUID()
  const { email } = await accessCommand<{ email: string }>(admin, identity, 'invite', { authId, id, digest: createHash('sha256').update(token).digest('hex') })
  const delivery = await sendAccessMessage(admin, { eventId: id, kind: 'invitation', to: email, url: origin + '/acceso#invitacion=' + token,...(local?{local:true}:{}) })
  await accessCommand(admin, identity, 'invite_result', { authId, id, delivery })
  return delivery
}
export async function createUserWithAccess(admin: SupabaseClient, identity: Pick<AccessIdentity, 'id' | 'sessionId' | 'aal'>,
  input: { nombre: string; email: string; rol: string; estado: string }, setup: UserAccessSetup,requestOrigin?:string): Promise<UserMutationResult> {
  if (setup.invite) accessOrigin(requestOrigin) // Configuración inválida no debe consumir un alta.
  const reservation = await accessCommand<{ completed: boolean; authId: string | null }>(admin, identity, 'create_begin', { ...input, ...setup })
  if (reservation.completed) {
    if (!reservation.authId) throw new AccessError('40001', 409)
    return { ok: true, created: true, userId: reservation.authId, invitation: 'not_sent' }
  }
  let authId = reservation.authId
  let temporary: string | undefined
  if (!authId) {
    const password = generatePassword(24)
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email, password, email_confirm: true,
      user_metadata: { nombre: input.nombre }, app_metadata: { qms_creation_id: setup.id }
    })
    if (error || !data.user) throw new AccessError('create_auth', 409)
    authId = data.user.id
    if (!setup.invite) temporary = password
  }
  await accessCommand(admin, identity, 'create_commit', { id: setup.id, authId })
  // El fallo de correo conserva Auth/perfil. Nunca se elimina/recrea la cuenta.
  let invitation: UserMutationResult['invitation'] = 'not_sent'
  if (setup.invite) { try { invitation = await inviteAccess(admin, identity, authId,requestOrigin) } catch { invitation = 'failed' } }
  return { ok: true, created: true, userId: authId, invitation, ...(temporary ? { tempPassword: temporary } : {}) }
}
