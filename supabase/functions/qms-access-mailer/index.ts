// @ts-expect-error Deno requiere la extensión.
import { loadEmailIdentity } from '../_shared/emailIdentity.ts'
// @ts-expect-error Deno requiere la extensión.
import { isAccessMailCode } from '../_shared/accessMailResult.ts'

interface Dependencies { env: (name: string) => string | undefined; fetcher?: typeof fetch; crypto?: Crypto; now?: () => number }
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true })
const uuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
function base64(bytes: Uint8Array) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
async function signature(value: { purpose: string; issuedAt: number; nonce: string; payload: string }, secret: string, cryptoApi: Crypto) {
  const key = await cryptoApi.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = new Uint8Array(await cryptoApi.subtle.sign('HMAC', key, enc.encode(`eca-qms-mail:v1:${value.purpose}\n${value.issuedAt}\n${value.nonce}\n${value.payload}`)))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
async function bodyBytes(response: Request | Response, max: number) {
  if (!response.body) throw new Error('invalid')
  const reader = response.body.getReader(); let size = 0; const parts: Uint8Array[] = []
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new Error('invalid') } parts.push(value) } } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0; for (const p of parts) { bytes.set(p, offset); offset += p.length } return bytes
}
async function equal(a: string, b: string, cryptoApi: Crypto) {
  const x = new Uint8Array(await cryptoApi.subtle.digest('SHA-256', enc.encode(a))), y = new Uint8Array(await cryptoApi.subtle.digest('SHA-256', enc.encode(b)))
  let diff = 0; for (let i = 0; i < x.length; i++)diff |= x[i] ^ y[i]; return diff === 0
}
/** Servicio de máquina separado del outbox de Quejas. No almacena código, URL ni destinatario. */
export function createAccessMailer(deps: Dependencies) {
  const fetcher = deps.fetcher ?? fetch, cryptoApi = deps.crypto ?? crypto, now = deps.now ?? Date.now
  return async (request: Request) => {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    const supplied = request.headers.get('apikey') ?? request.headers.get('authorization')?.replace(/^Bearer /i, '') ?? ''
    if (!supplied || supplied.length > 4096 || supplied.startsWith('sb_publishable_')) return json({ error: 'unauthorized' }, 401)
    let dispatchStarted = false
    let phase: 'transport' | 'message' | 'identity' | 'provider' | 'receipt' = 'transport'
    try {
      // Valida la credencial con el proveedor, sin confiar en claims sin firma ni
      // comparar JWT antiguos con una copia del runtime que puede ser distinta.
      // Este RPC solo tiene EXECUTE para service_role: anon y sesiones de usuario
      // no pueden convertir esta función en un emisor público. Se reutiliza la
      // lectura de transporte, sin otra consulta ni credenciales nuevas.
      const url = new URL(deps.env('SUPABASE_URL') ?? '')
      const config = await fetcher(url.origin + '/rest/v1/rpc/qms_access_mail_transport', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supplied,
          ...(supplied.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + supplied }) },
        body: '{}', signal: AbortSignal.timeout(15_000),
      })
      if (config.status === 401 || config.status === 403) return json({ error: 'unauthorized' }, 401)
      if (!config.ok) throw new Error('unavailable')
      const transport = JSON.parse(dec.decode(await bodyBytes(config, 2048))), endpoint = new URL(transport.endpoint)
      if (!transport.enabled || endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint.pathname)) throw new Error('unavailable')
      const secret = deps.env('QUEJAS_MAIL_SIGNING_SECRET') ?? ''
      if (secret.length < 32) throw new Error('unavailable')
      phase = 'message'
      const message = JSON.parse(dec.decode(await bodyBytes(request, 2048)))
      if (!message || typeof message !== 'object' || Array.isArray(message) || !uuid(message.eventId) || !['invitation', 'email_otp', 'temporary_access'].includes(message.kind)
        || typeof message.to !== 'string' || message.to.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(message.to)) throw new Error('invalid')
      const fields = ['eventId', 'kind', 'to', ...(message.kind === 'temporary_access' ? ['name', 'password', 'url'] : message.kind === 'invitation' ? ['url'] : ['code'])]
      if(message.kind==='invitation'&&message.local===true)fields.push('local')
      if (Object.keys(message).sort().join(',') !== fields.sort().join(',')) throw new Error('invalid')
      if (message.kind === 'email_otp' && (typeof message.code !== 'string' || !/^\d{6}$/.test(message.code))) throw new Error('invalid')
      if (message.kind === 'invitation') {
        const url = new URL(message.url), origin = message.local===true?null:new URL(deps.env('PUBLIC_TRACKING_ORIGIN') ?? '').origin
        const allowed=message.local===true?['http://localhost:3000','http://127.0.0.1:3000'].includes(url.origin):url.origin===origin&&url.protocol==='https:'
        if (!allowed||url.username||url.password||url.pathname !== '/acceso' || url.search || !/^#invitacion=[A-Za-z0-9_-]{43}$/.test(url.hash)) throw new Error('invalid')
      }
      if (message.kind === 'temporary_access') {
        const origin = new URL(deps.env('PUBLIC_TRACKING_ORIGIN') ?? '')
        if (origin.protocol !== 'https:' || message.url !== origin.origin + '/login'
          || typeof message.name !== 'string' || !message.name.trim() || message.name.length > 200 || /[\r\n]/.test(message.name)
          || typeof message.password !== 'string' || !/^[!-~]{14,72}$/.test(message.password)) throw new Error('invalid')
      }
      phase = 'identity'
      const identidadCorreo = await loadEmailIdentity(url.origin, supplied, deps.env('EMAIL_LOGO_STYLE'), fetcher,
        async assetResponse => JSON.parse(dec.decode(await bodyBytes(assetResponse, 4096))))
      const branded = { ...message, identidadCorreo }
      const envelope = { version: 1, purpose: 'access_delivery_request', issuedAt: Math.floor(now() / 1000), nonce: cryptoApi.randomUUID(), payload: base64(enc.encode(JSON.stringify(branded))) }
      const signed = { ...envelope, signature: await signature(envelope, secret, cryptoApi) }
      dispatchStarted = true
      phase = 'provider'
      const response = await fetcher(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signed), signal: AbortSignal.timeout(25_000), redirect: 'follow' })
      phase = 'receipt'
      const receipt = JSON.parse(dec.decode(await bodyBytes(response, 4096)))
      // Respuesta explícita de validación de Google: todavía no ejecutó MailApp.
      // No confundirla con un timeout posterior al envío, que sí es incierto.
      if (receipt?.error === 'invalid_access_delivery') {
        console.warn('qms_access_mailer_rejected', { phase: 'google_validation' })
        return json({ outcome: 'failed', code: 'provider_rejected' }, 503)
      }
      if (!response.ok || receipt.version !== 1 || receipt.purpose !== 'access_delivery_receipt' || !uuid(receipt.nonce)
        || !Number.isSafeInteger(receipt.issuedAt) || Math.abs(receipt.issuedAt - Math.floor(now() / 1000)) > 300 || typeof receipt.payload !== 'string'
        || typeof receipt.signature !== 'string' || !await equal(receipt.signature, await signature(receipt, secret, cryptoApi), cryptoApi)) throw new Error('unavailable')
      const decoded = atob(receipt.payload.replace(/-/g, '+').replace(/_/g, '/')), payload = JSON.parse(dec.decode(Uint8Array.from(decoded, c => c.charCodeAt(0))))
      if (payload.eventId !== message.eventId || payload.requestNonce !== envelope.nonce || !['sent', 'failed', 'uncertain', 'retry'].includes(payload.outcome)) throw new Error('unavailable')
      return json({ outcome: payload.outcome === 'retry' ? 'failed' : payload.outcome,
        ...(isAccessMailCode(payload.code) ? { code: payload.code } : {}) })
    } catch {
      // Los únicos campos de telemetría son etapas cerradas y estado del dispatch;
      // nunca registrar destinatarios, claves, tokens ni contenido del mensaje.
      console.warn('qms_access_mailer_failure', { phase, dispatchStarted })
      // Una respuesta perdida puede haber enviado: no reintentar a ciegas.
      return json(dispatchStarted ? { outcome: 'uncertain', code: 'delivery_uncertain' }
        : { outcome: 'failed', code: 'access_mail_unavailable' }, 503)
    }
  }
}
declare const Deno: { env: { get: (name: string) => string | undefined }; serve: (handler: (request: Request) => Promise<Response>) => void } | undefined
if (typeof Deno !== 'undefined') Deno.serve(createAccessMailer({ env: name => Deno.env.get(name) }))
