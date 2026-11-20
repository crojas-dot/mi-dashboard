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
/** Logo institucional público y opcional; nunca depende de un dato enviado por el usuario. */
async function accessLogo(origin: string, key: string, fetcher: typeof fetch): Promise<string | null> {
  try {
    const url = new URL('/rest/v1/configuraciones_sistema', origin)
    url.search = new URLSearchParams({ select: 'clave,valor', clave: 'eq.org.identidad.login_encabezado' }).toString()
    const res = await fetcher(url.href, {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(2000),
      headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + key }) },
    })
    if (!res.ok) { await res.body?.cancel().catch(() => undefined); return null }
    const rows = JSON.parse(dec.decode(await bodyBytes(res, 2048)))
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.clave !== 'org.identidad.login_encabezado') return null
    const value = rows[0].valor
    if (typeof value !== 'string') return null
    const image = new URL(value)
    if (image.origin !== origin || image.username || image.password || image.search || image.hash
      || !/^\/storage\/v1\/object\/public\/branding\/identidad\/login_encabezado\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i.test(image.pathname)) return null
    return image.href
  } catch { return null }
}
/** Servicio de máquina separado del outbox de Quejas. No almacena código, URL ni destinatario. */
export function createAccessMailer(deps: Dependencies) {
  const fetcher = deps.fetcher ?? fetch, cryptoApi = deps.crypto ?? crypto, now = deps.now ?? Date.now
  return async (request: Request) => {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    const supplied = request.headers.get('apikey') ?? request.headers.get('authorization')?.replace(/^Bearer /i, '') ?? ''
    if (!supplied || supplied.length > 4096 || supplied.startsWith('sb_publishable_')) return json({ error: 'unauthorized' }, 401)
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
      const message = JSON.parse(dec.decode(await bodyBytes(request, 2048)))
      if (!message || typeof message !== 'object' || Array.isArray(message) || !uuid(message.eventId) || !['invitation', 'email_otp'].includes(message.kind)
        || typeof message.to !== 'string' || message.to.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(message.to)) throw new Error('invalid')
      const fields = message.kind === 'invitation' ? ['eventId', 'kind', 'to', 'url'] : ['eventId', 'kind', 'to', 'code']
      if(message.kind==='invitation'&&message.local===true)fields.push('local')
      if (Object.keys(message).sort().join(',') !== fields.sort().join(',')) throw new Error('invalid')
      if (message.kind === 'email_otp' && (typeof message.code !== 'string' || !/^\d{6}$/.test(message.code))) throw new Error('invalid')
      if (message.kind === 'invitation') {
        const url = new URL(message.url), origin = message.local===true?null:new URL(deps.env('PUBLIC_TRACKING_ORIGIN') ?? '').origin
        const allowed=message.local===true?['http://localhost:3000','http://127.0.0.1:3000'].includes(url.origin):url.origin===origin&&url.protocol==='https:'
        if (!allowed||url.username||url.password||url.pathname !== '/acceso' || url.search || !/^#invitacion=[A-Za-z0-9_-]{43}$/.test(url.hash)) throw new Error('invalid')
      }
      const logo = await accessLogo(url.origin, supplied, fetcher)
      const branded = logo ? { ...message, logo } : message
      const envelope = { version: 1, purpose: 'access_delivery_request', issuedAt: Math.floor(now() / 1000), nonce: cryptoApi.randomUUID(), payload: base64(enc.encode(JSON.stringify(branded))) }
      const signed = { ...envelope, signature: await signature(envelope, secret, cryptoApi) }
      const response = await fetcher(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signed), signal: AbortSignal.timeout(25_000), redirect: 'follow' })
      const receipt = JSON.parse(dec.decode(await bodyBytes(response, 4096)))
      if (!response.ok || receipt.version !== 1 || receipt.purpose !== 'access_delivery_receipt' || !uuid(receipt.nonce)
        || !Number.isSafeInteger(receipt.issuedAt) || Math.abs(receipt.issuedAt - Math.floor(now() / 1000)) > 300 || typeof receipt.payload !== 'string'
        || typeof receipt.signature !== 'string' || !await equal(receipt.signature, await signature(receipt, secret, cryptoApi), cryptoApi)) throw new Error('unavailable')
      const decoded = atob(receipt.payload.replace(/-/g, '+').replace(/_/g, '/')), payload = JSON.parse(dec.decode(Uint8Array.from(decoded, c => c.charCodeAt(0))))
      if (payload.eventId !== message.eventId || payload.requestNonce !== envelope.nonce || !['sent', 'failed', 'uncertain', 'retry'].includes(payload.outcome)) throw new Error('unavailable')
      return json({ outcome: payload.outcome === 'retry' ? 'failed' : payload.outcome })
    } catch {
      // Una respuesta perdida puede haber enviado: no reintentar el mismo código a ciegas.
      return json({ outcome: 'uncertain' }, 503)
    }
  }
}
declare const Deno: { env: { get: (name: string) => string | undefined }; serve: (handler: (request: Request) => Promise<Response>) => void } | undefined
if (typeof Deno !== 'undefined') Deno.serve(createAccessMailer({ env: name => Deno.env.get(name) }))
