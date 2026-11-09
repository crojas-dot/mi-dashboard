import 'server-only'
import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readPublicJson } from '@/lib/server/publicForms/bodies'
import { PublicGatewayError, publicBackend, publicFailure, publicReply } from '@/lib/server/publicForms/gateway'
import { PublicFormsUnavailableError } from '@/lib/server/publicForms/config'
import { verifyPublicBot } from '@/lib/server/publicForms/botProtection'
import { mintPublicTrackingCapability, verifyPublicTrackingCapability, validatePublicTrackingSecret, buildPublicTrackingUrl } from '@/supabase/functions/_shared/publicTrackingCapability'
import { publicTrackingStatus } from '@/lib/types/publicTracking'

export const trackingEnabled = () => process.env.PUBLIC_TRACKING_ENABLED === 'true'

/** Solo disponibilidad pública de configuración; nunca enviar valores de secretos a la página. */
export function publicTrackingAvailable(): boolean {
  try { publicTrackingConfig(); return true } catch { return false }
}

export function publicTrackingConfig() {
  if (!trackingEnabled()) throw new PublicFormsUnavailableError()
  const secret = validatePublicTrackingSecret(process.env.PUBLIC_TRACKING_SIGNING_SECRET)
  const origin = process.env.PUBLIC_TRACKING_ORIGIN ?? ''
  // La URL se configura en servidor: Host/Origin del visitante nunca decide el enlace del correo.
  buildPublicTrackingUrl(origin, 'validation.token', { allowLocalHttp: process.env.NODE_ENV !== 'production' })
  return { secret, origin }
}

export function trackingReply(value: unknown, status = 200) {
  const response = publicReply(value, status)
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return response
}

export function trackingFailure(error: unknown) {
  if (error instanceof PublicGatewayError && error.status === 404) return trackingReply({ error: 'No se pudo consultar el trámite. El enlace puede ser inválido o haber vencido. Contactá a Gestión de Calidad si necesitás ayuda.' }, 404)
  const response = publicFailure(error)
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return response
}

export async function trackingRpc(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.rpc(name, args)
  // No propagar detalles SQL, identificadores ni tokens al visitante o a los logs.
  if (error?.code === '42501' || error?.code === 'P0002') throw new PublicGatewayError(404, 'tracking_not_found')
  if (error) throw new PublicFormsUnavailableError()
  return data
}

export async function publicTrackingRequest(request: Request, document = false) {
  const config = publicTrackingConfig()
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) throw new PublicGatewayError(404, 'tracking_not_found')
  // Lectura y descarga públicas comparten la prueba anti-bot antes de usar DB o Drive.
  await verifyPublicBot(request)
  const client = publicBackend()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if ((!ip || !isIP(ip)) && process.env.NODE_ENV === 'production') throw new PublicFormsUnavailableError()
  const key = createHmac('sha256', config.secret).update('qms-tracking-rate-v1\0').update(ip ?? 'local').digest('hex')
  const quota = await trackingRpc(client, 'public_form_consume_rate', { p_key_hash: key, p_operation: 'attempt', p_limit: 60, p_window_seconds: 900 }) as { allowed?: boolean; retry_after?: number } | null
  if (quota?.allowed !== true) throw new PublicGatewayError(429, 'public_rate_limited', 900)
  const body = await readPublicJson(request)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PublicGatewayError(404, 'tracking_not_found')
  const input = body as Record<string, unknown>
  if (Object.keys(input).some(key => !['clave', 'folio', ...(document ? ['documentoId'] : [])].includes(key))
    || (input.folio !== undefined && (typeof input.folio !== 'string' || input.folio.length > 120))
    || (document && (typeof input.documentoId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.documentoId)))) throw new PublicGatewayError(404, 'tracking_not_found')
  let claims
  // La firma identifica la capacidad; cada RPC comprueba su revocación y caducidad
  // en DB. El cierre futuro no se puede anticipar al firmar el correo de recepción.
  try { claims = await verifyPublicTrackingCapability(input.clave, config.secret) }
  catch { throw new PublicGatewayError(404, 'tracking_not_found') }
  return { client, claims, input }
}

export async function readPublicTracking(request: Request) {
  const { client, claims, input } = await publicTrackingRequest(request)
  const value = await trackingRpc(client, 'qms_public_tracking_read', { p_queja_id: claims.quejaId, p_nonce: claims.nonce })
  if (!value) throw new PublicGatewayError(404, 'tracking_not_found')
  const status = publicTrackingStatus(value)
  if (input.folio !== undefined && input.folio !== status.folio) throw new PublicGatewayError(404, 'tracking_not_found')
  return status
}

export async function trackingLinkForCase(client: SupabaseClient, quejaId: string) {
  const { secret, origin } = publicTrackingConfig()
  const access = await trackingRpc(client, 'qms_public_tracking_access', { p_queja_id: quejaId }) as { nonce?: string } | null
  if (!access?.nonce) throw new PublicGatewayError(404, 'tracking_not_found')
  const clave = await mintPublicTrackingCapability({ quejaId, nonce: access.nonce }, secret)
  return buildPublicTrackingUrl(origin, clave, { allowLocalHttp: process.env.NODE_ENV !== 'production' })
}
