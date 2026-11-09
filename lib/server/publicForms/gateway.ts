import 'server-only'
import { isIP } from 'node:net'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { logger } from '@/lib/utils/logger'
import { hashPublicRateKey } from './uploadCapability'
import { PublicFormsInputError } from './validation'
import { PublicFormsUnavailableError } from './config'

export class PublicGatewayError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryAfter?: number) { super('No se pudo completar la solicitud pública') }
}

export function publicBackend(): SupabaseClient {
  const client = createServiceClient()
  if (!client) throw new PublicFormsUnavailableError()
  return client
}

export async function publicRpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) {
    if (error.code === 'P0001' && error.message === 'PUBLIC_RATE_LIMITED') {
      const seconds = Number(error.details)
      throw new PublicGatewayError(429, 'public_rate_limited', Number.isFinite(seconds) ? Math.max(1, Math.min(3600, Math.ceil(seconds))) : 900)
    }
    if (error.code === '54000' && error.message === 'PUBLIC_UPLOAD_QUOTA') throw new PublicGatewayError(409, 'public_upload_quota')
    if (error.code === '23505') throw new PublicGatewayError(409, 'submission_conflict')
    // 22023 también identifica configuración interna: no culpar al ciudadano ni
    // liberar su ID para otro envío cuando el contrato de servidor está fallando.
    if (error.code === '22023' && error.message === 'PUBLIC_SUBMISSION_INPUT_INVALID') {
      throw new PublicGatewayError(400, 'invalid_public_request')
    }
    if (error.code === '42501') throw new PublicGatewayError(403, 'public_access_denied')
    logger.error('Falló la operación pública', { module: 'public_forms', action: 'rpc' }, error)
    throw new PublicFormsUnavailableError()
  }
  if (data == null) throw new PublicFormsUnavailableError()
  return data as T
}

export function publicIpKey(request: Request, secret: string) {
  // Vercel sobrescribe X-Forwarded-For. No confiar en IP aportada por el body.
  const value = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (value && isIP(value)) return hashPublicRateKey(value.toLowerCase(), secret)
  if (process.env.NODE_ENV === 'production') throw new PublicFormsUnavailableError()
  return hashPublicRateKey('local-development', secret)
}

export async function consumePublicRate(client: SupabaseClient, key: string, operation: 'attempt' | 'upload') {
  const limits = operation === 'attempt' ? { limit: 10, window: 900 } : { limit: 30, window: 900 }
  const result = await publicRpc<{ allowed: boolean; retry_after: number }>(client, 'public_form_consume_rate', {
    p_key_hash: key, p_operation: operation, p_limit: limits.limit, p_window_seconds: limits.window,
  })
  if (!result.allowed) throw new PublicGatewayError(429, 'public_rate_limited', Math.max(1, result.retry_after))
}

export function publicReply(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export function publicFailure(error: unknown): Response {
  const expected = error instanceof PublicGatewayError || error instanceof PublicFormsInputError || error instanceof PublicFormsUnavailableError
  const status = expected ? error.status : 503
  const code = expected ? error.code : 'public_service_unavailable'
  if (!expected) logger.error('Falló solicitud pública', { module: 'public_forms', action: 'request' }, error)
  const message = status === 429 ? 'Demasiadas solicitudes. Intentá más tarde.' : status === 409 ? 'Reintentá el mismo envío más tarde.' : status === 503 ? 'El servicio no está disponible en este momento.' : 'No se pudo verificar o procesar la solicitud.'
  const response = publicReply({ error: message, code }, status)
  if (error instanceof PublicGatewayError && error.retryAfter) response.headers.set('Retry-After', String(error.retryAfter))
  return response
}
