// @ts-expect-error Deno requiere la extensión; este módulo también lo comprueba el tsc de Next sin resolver Deno.
import { claimMailSnapshot, isMailUuid, quejaMailMessage } from './message.ts'
// @ts-expect-error La extensión es necesaria en Deno; el servidor web reutiliza el contrato Web Crypto.
import { buildPublicTrackingUrl, mintPublicTrackingCapability, validatePublicTrackingSecret } from '../_shared/publicTrackingCapability.ts'

type QueuePurpose = 'claim_request' | 'claim_receipt' | 'authorize_request' | 'authorize_receipt'
  | 'ack_request' | 'ack_receipt' | 'health_request' | 'health_receipt'
interface QueueEnvelope { version: 1; purpose: QueuePurpose; issuedAt: number; nonce: string; payload: string; signature: string }
interface QueueDependencies {
  env: (name: string) => string | undefined
  fetcher?: typeof fetch
  crypto?: Crypto
  now?: () => number
}
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const REQUEST_BYTES = 8_192
const RESPONSE_BYTES = 65_536
const OUTCOME_CODES: Record<string, readonly string[]> = {
  sent: ['sent', 'already_sent'],
  retry: ['quota_exhausted', 'ledger_busy', 'ledger_unavailable', 'disabled', 'batch_not_started', 'authorization_unavailable'],
  uncertain: ['delivery_uncertain'],
  failed: ['event_conflict', 'invalid_delivery', 'invalid_mail_snapshot'],
  skipped: ['obsolete_notice'],
}

class QueueError extends Error {
  constructor(readonly status = 401, readonly code = 'invalid_mail_queue_request') { super(code) }
}

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key))) throw new QueueError()
  return value as Record<string, unknown>
}

function base64url(bytes: Uint8Array) {
  // Los tamaños se acotan antes; no usar spread con arrays grandes en el runtime Edge.
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodedPayload(payload: string) {
  try {
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    if (base64url(bytes) !== payload) throw new QueueError()
    return JSON.parse(decoder.decode(bytes)) as unknown
  } catch { throw new QueueError() }
}

function signingInput(envelope: Omit<QueueEnvelope, 'signature'>) {
  return `eca-qms-mail:v1:${envelope.purpose}\n${envelope.issuedAt}\n${envelope.nonce}\n${envelope.payload}`
}

async function hmacKey(secret: string, cryptoApi: Crypto) {
  return cryptoApi.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** El mismo formato v1 que Apps Script; propósitos distintos impiden reutilizar la firma legacy. */
export async function signQueueEnvelope(purpose: QueuePurpose, payload: unknown, secret: string,
  cryptoApi: Crypto = crypto, now = Date.now()): Promise<QueueEnvelope> {
  const envelope = { version: 1 as const, purpose, issuedAt: Math.floor(now / 1000), nonce: cryptoApi.randomUUID(),
    payload: base64url(encoder.encode(JSON.stringify(payload))) }
  const signature = new Uint8Array(await cryptoApi.subtle.sign('HMAC', await hmacKey(secret, cryptoApi), encoder.encode(signingInput(envelope))))
  return { ...envelope, signature: Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('') }
}

async function authenticate(value: unknown, secret: string, cryptoApi: Crypto, now: number) {
  const candidate = record(value, ['version', 'purpose', 'issuedAt', 'nonce', 'payload', 'signature'])
  if (candidate.version !== 1 || !['claim_request', 'authorize_request', 'ack_request', 'health_request'].includes(String(candidate.purpose))
    || !Number.isSafeInteger(candidate.issuedAt) || Math.floor(now / 1000) - Number(candidate.issuedAt) > 300
    || Number(candidate.issuedAt) - Math.floor(now / 1000) > 30 || !isMailUuid(candidate.nonce)
    || typeof candidate.payload !== 'string' || candidate.payload.length > REQUEST_BYTES
    || !/^[A-Za-z0-9_-]+$/.test(candidate.payload)
    || typeof candidate.signature !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.signature)) throw new QueueError()
  const envelope = candidate as unknown as QueueEnvelope
  const signature = Uint8Array.from(envelope.signature.match(/.{2}/g)!, value => Number.parseInt(value, 16))
  if (!await cryptoApi.subtle.verify('HMAC', await hmacKey(secret, cryptoApi), signature, encoder.encode(signingInput(envelope)))) {
    throw new QueueError()
  }
  return { envelope, payload: decodedPayload(envelope.payload) }
}

async function readJson(body: ReadableStream<Uint8Array> | null, maximum: number, signal?: AbortSignal) {
  if (!body) throw new QueueError()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      signal?.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maximum) { await reader.cancel(); throw new QueueError(413, 'mail_queue_body_too_large') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(decoder.decode(bytes)) as unknown }
  catch { throw new QueueError() }
}

const isJson = (headers: Headers) => headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'application/json'

function response(value: unknown, status = 200): Response {
  const body = JSON.stringify(value)
  if (encoder.encode(body).byteLength > RESPONSE_BYTES) throw new QueueError(503, 'mail_queue_unavailable')
  return new Response(body, { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

function databaseConfig(env: QueueDependencies['env']) {
  // Las claves nuevas no son JWT: se envían solo en apikey. El fallback permite
  // proyectos que aún no tienen una clave default moderna, sin copiarla a Apps Script.
  let modernKey: string | undefined
  const modernKeys = env('SUPABASE_SECRET_KEYS')
  if (modernKeys) {
    let values: unknown
    try { values = JSON.parse(modernKeys) } catch { throw new QueueError(503, 'mail_queue_unavailable') }
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new QueueError(503, 'mail_queue_unavailable')
    const value = (values as Record<string, unknown>).default
    if (value !== undefined && (typeof value !== 'string' || !value.startsWith('sb_secret_'))) throw new QueueError(503, 'mail_queue_unavailable')
    modernKey = value as string | undefined
  }
  const key = modernKey ?? env('SUPABASE_SERVICE_ROLE_KEY')
  let url: URL
  try { url = new URL(env('SUPABASE_URL') ?? '') } catch { throw new QueueError(503, 'mail_queue_unavailable') }
  if (!key || url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new QueueError(503, 'mail_queue_unavailable')
  }
  return { url, key, legacyJwt: !modernKey }
}

async function rpc(config: ReturnType<typeof databaseConfig>, name: 'qms_mail_claim_batch_v2' | 'qms_mail_claim_batch_v3' | 'qms_mail_claim_batch_v4' | 'qms_mail_claim_urgent_batch' | 'qms_mail_authorize_v2' | 'qms_mail_complete',
  args: Record<string, unknown>, fetcher: typeof fetch) {
  const result = await fetcher(new URL(`/rest/v1/rpc/${name}`, config.url).toString(), {
    method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', apikey: config.key,
      ...(config.legacyJwt ? { Authorization: `Bearer ${config.key}` } : {}) },
    body: JSON.stringify(args),
  })
  if (!result.ok || !isJson(result.headers)
    || Number(result.headers.get('content-length')) > RESPONSE_BYTES) {
    await result.body?.cancel().catch(() => undefined)
    throw new QueueError(503, 'mail_queue_unavailable')
  }
  try { return await readJson(result.body, RESPONSE_BYTES) }
  catch { throw new QueueError(503, 'mail_queue_unavailable') }
}

/** Solo un evento final autorizado puede revelar su único documento publicado al emisor HMAC. */
async function officialDocument(config: ReturnType<typeof databaseConfig>, id: string, claim: string, fetcher: typeof fetch, now: number) {
  const eligible = await rpc(config, 'qms_mail_authorize_v2', { p_id: id, p_claim_token: claim }, fetcher)
  if (typeof eligible !== 'boolean') throw new QueueError(503, 'mail_queue_unavailable')
  if (!eligible) return { authorized: false, document: null }
  const read = async (table: string, params: Record<string, string>) => {
    const url = new URL('/rest/v1/' + table, config.url)
    url.search = new URLSearchParams(params).toString()
    const result = await fetcher(url, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json', apikey: config.key, ...(config.legacyJwt ? { Authorization: `Bearer ${config.key}` } : {}) } })
    if (!result.ok || !isJson(result.headers)) { await result.body?.cancel().catch(() => undefined); throw new QueueError(503, 'mail_queue_unavailable') }
    const rows = await readJson(result.body, RESPONSE_BYTES)
    if (!Array.isArray(rows) || rows.length > 1) throw new QueueError(503, 'mail_queue_unavailable')
    return rows[0] as Record<string, unknown> | undefined
  }
  const event = await read('queja_mail_outbox', { select: 'queja_id,tipo,lease_until,queja:quejas(estado)', id: 'eq.' + id, claim_token: 'eq.' + claim, status: 'eq.leased', limit: '1' })
  const state = (event?.queja as Record<string, unknown> | null)?.estado
  if (!event || event.tipo !== 'final' || typeof event.lease_until !== 'string'
    || !Number.isFinite(Date.parse(event.lease_until)) || Date.parse(event.lease_until) <= now
    || !['Resuelto', 'Finalizado', 'No Procede'].includes(String(state))) return { authorized: false, document: null }
  if (!isMailUuid(event.queja_id)) throw new QueueError(503, 'mail_queue_unavailable')
  const publication = await read('queja_public_resolutions', { select: 'adjunto:queja_adjuntos(queja_id,storage_path,nombre,tipo_mime,tamano)', queja_id: 'eq.' + event.queja_id, limit: '1' })
  // El adjunto se obtiene del expediente, sin depender del enlace que caduca.
  if (!publication) throw new QueueError(503, 'mail_queue_unavailable')
  const file = publication.adjunto as Record<string, unknown> | null
  if (!file || file.queja_id !== event.queja_id || typeof file.storage_path !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(file.storage_path)
    || typeof file.nombre !== 'string' || !file.nombre.trim() || file.nombre.length > 255 || /[\u0000-\u001f\u007f/\\]/.test(file.nombre)
    || typeof file.tipo_mime !== 'string' || file.tipo_mime.length > 127 || !/^[A-Za-z0-9][A-Za-z0-9.+_-]*\/[A-Za-z0-9][A-Za-z0-9.+_-]*$/.test(file.tipo_mime)
    || !Number.isSafeInteger(file.tamano) || Number(file.tamano) < 1 || Number(file.tamano) > 4194304) throw new QueueError(503, 'mail_queue_unavailable')
  return { authorized: true, document: { driveId: file.storage_path, name: file.nombre, mime: file.tipo_mime, size: file.tamano } }
}

export function createQuejasMailQueueHandler(dependencies: QueueDependencies) {
  const cryptoApi = dependencies.crypto ?? crypto
  const now = dependencies.now ?? Date.now
  const fetcher = dependencies.fetcher ?? fetch
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return response({ error: 'mail_queue_method_not_allowed' }, 405)
    try {
      if (!isJson(request.headers)) throw new QueueError()
      if (Number(request.headers.get('content-length')) > REQUEST_BYTES) throw new QueueError(413, 'mail_queue_body_too_large')
      const input = await readJson(request.body, REQUEST_BYTES, request.signal)
      const secret = dependencies.env('QUEJAS_MAIL_SIGNING_SECRET')
      if (!secret || encoder.encode(secret).byteLength < 32) throw new QueueError(503, 'mail_queue_unavailable')
      const startedAt = now()
      const { envelope, payload } = await authenticate(input, secret, cryptoApi, startedAt)
      let args: Record<string, unknown>
      if (envelope.purpose === 'health_request') {
        record(payload, [])
        // Comprueba firma/configuración sin leer credenciales DB, consumir nonce ni reservar eventos.
        return response(await signQueueEnvelope('health_receipt', { requestNonce: envelope.nonce,
          enabled: dependencies.env('QUEJAS_MAIL_QUEUE_ENABLED') === 'true' }, secret, cryptoApi, now()))
      }
      if (envelope.purpose === 'claim_request') {
        const value = record(payload, ['limit', 'citizenOnly'])
        // Cero despacha los avisos en DB sin reservar correo: las campanas no dependen de MailApp.
        if (!Number.isInteger(value.limit) || Number(value.limit) < 0 || Number(value.limit) > 5
          || value.citizenOnly !== undefined && typeof value.citizenOnly !== 'boolean') throw new QueueError()
        // Dos mensajes máximos de 3500 unidades UTF-16 caben en el sobre base64
        // de 64 KiB que acepta Apps Script, incluso con Unicode y seguimiento.
        // Acotar antes de reclamar evita dejar un lote reservado que no puede entregarse.
        args = { p_limit: Math.min(Number(value.limit), 2), p_lease_seconds: 600, p_run_nonce: envelope.nonce, p_issued_at: envelope.issuedAt }
      } else if (envelope.purpose === 'authorize_request') {
        const value = record(payload, ['eventId', 'claimToken', 'includeOfficialDocument'])
        if (!isMailUuid(value.eventId) || !isMailUuid(value.claimToken)
          || value.includeOfficialDocument !== undefined && typeof value.includeOfficialDocument !== 'boolean') throw new QueueError()
        args = { p_id: value.eventId, p_claim_token: value.claimToken }
      } else {
        const value = record(payload, ['eventId', 'claimToken', 'outcome', 'code', 'retryAfterSeconds'])
        if (!isMailUuid(value.eventId) || !isMailUuid(value.claimToken)
          || typeof value.outcome !== 'string' || !Object.hasOwn(OUTCOME_CODES, value.outcome)
          || typeof value.code !== 'string' || !OUTCOME_CODES[value.outcome].includes(value.code)
          || !Number.isSafeInteger(value.retryAfterSeconds) || Number(value.retryAfterSeconds) < 60
          || Number(value.retryAfterSeconds) > 86_400) throw new QueueError()
        args = { p_id: value.eventId, p_claim_token: value.claimToken, p_outcome: value.outcome,
          p_retry_delay_seconds: value.retryAfterSeconds, p_safe_error: value.outcome === 'sent' ? null : value.code }
      }
      if (dependencies.env('QUEJAS_MAIL_QUEUE_ENABLED') !== 'true') return response({ error: 'mail_queue_disabled' }, 503)
      // Solo después de autenticar y validar el contrato se leen credenciales privilegiadas.
      const database = databaseConfig(dependencies.env)
      if (envelope.purpose === 'claim_request') {
        const trackingEnabled = dependencies.env('PUBLIC_TRACKING_ENABLED') === 'true'
        let trackingSecret: string | undefined, trackingOrigin: string | undefined
        if (trackingEnabled) {
          trackingSecret = validatePublicTrackingSecret(dependencies.env('PUBLIC_TRACKING_SIGNING_SECRET'))
          trackingOrigin = dependencies.env('PUBLIC_TRACKING_ORIGIN')
          // Fallar antes de reservar un lote si falta la configuración del destino público.
          buildPublicTrackingUrl(trackingOrigin ?? '', 'configuration.check')
        }
        const data = await rpc(database, (payload as Record<string, unknown>).citizenOnly === true ? 'qms_mail_claim_urgent_batch' : 'qms_mail_claim_batch_v4', args, fetcher)
        if (!Array.isArray(data) || data.length > Number(args.p_limit)) throw new QueueError(503, 'mail_queue_unavailable')
        const ids = new Set<string>()
        const messages = await Promise.all(data.map(async value => {
          const row = claimMailSnapshot(value, { internal: true })
          if (ids.has(row.id)) throw new QueueError(503, 'mail_queue_unavailable')
          ids.add(row.id)
          const trackingUrl = trackingEnabled && row.public_tracking && row.tipo === 'recibido'
            ? buildPublicTrackingUrl(trackingOrigin!, await mintPublicTrackingCapability({
              quejaId: row.public_tracking.queja_id, nonce: row.public_tracking.nonce,
            }, trackingSecret!, { crypto: cryptoApi })) : undefined
          return { ...quejaMailMessage(row, { trackingUrl }), claimToken: row.claim_token }
        }))
        // DB otorga 600s desde su propia transacción; 540s desde antes del HTTP es conservador.
        const leaseUntilMillis = Math.floor(startedAt / 1000) * 1000 + 540_000
        if (now() >= leaseUntilMillis) throw new QueueError(503, 'mail_queue_unavailable')
        const leaseUntil = new Date(leaseUntilMillis).toISOString()
        return response(await signQueueEnvelope('claim_receipt', { requestNonce: envelope.nonce, leaseUntil, messages }, secret, cryptoApi, now()))
      }
      if (envelope.purpose === 'authorize_request') {
        // Revalidar el usuario y el hito en DB; este endpoint no acepta destinatario ni regla.
        const include = (payload as Record<string, unknown>).includeOfficialDocument === true
        const delivery = include ? await officialDocument(database, String(args.p_id), String(args.p_claim_token), fetcher, now()) : null
        const authorized = delivery ? delivery.authorized : await rpc(database, 'qms_mail_authorize_v2', args, fetcher)
        if (typeof authorized !== 'boolean') throw new QueueError(503, 'mail_queue_unavailable')
        const document = delivery?.document ?? null
        return response(await signQueueEnvelope('authorize_receipt', { requestNonce: envelope.nonce,
          eventId: args.p_id, authorized, ...(include ? { officialDocument: document } : {}) }, secret, cryptoApi, now()))
      }
      const accepted = await rpc(database, 'qms_mail_complete', args, fetcher)
      if (typeof accepted !== 'boolean') throw new QueueError(503, 'mail_queue_unavailable')
      // CAS falso significa confirmación no aceptada; nunca se traduce en permiso de reenvío.
      return response(await signQueueEnvelope('ack_receipt', { requestNonce: envelope.nonce, eventId: args.p_id, accepted }, secret, cryptoApi, now()))
    } catch (error) {
      // Nunca incluir errores de PostgREST, payload firmado, claims, destinatarios ni secretos.
      return error instanceof QueueError ? response({ error: error.code }, error.status)
        : response({ error: 'mail_queue_unavailable' }, 503)
    }
  }
}

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void }
if (typeof Deno !== 'undefined') Deno.serve(createQuejasMailQueueHandler({ env: name => Deno.env.get(name) }))
