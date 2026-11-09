/** Contrato compartido entre el servidor web y Edge. Nunca importarlo desde UI. */
export interface PublicTrackingCapability { quejaId: string; nonce: string }
interface CapabilityOptions { crypto?: Crypto }
const PURPOSE = 'qms-public-tracking-v2'
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const invalid = () => new Error('invalid_public_tracking_capability')

export function validatePublicTrackingSecret(secret: unknown): string {
  if (typeof secret !== 'string' || secret !== secret.trim() || /[\u0000-\u001f\u007f]/.test(secret)
    || encoder.encode(secret).byteLength < 32 || encoder.encode(secret).byteLength > 4096) throw invalid()
  return secret
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unbase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid()
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  if (base64url(bytes) !== value) throw invalid()
  return bytes
}

function claims(value: PublicTrackingCapability): PublicTrackingCapability {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 2 || Object.keys(value).some(key => !['quejaId', 'nonce'].includes(key))
    || typeof value.quejaId !== 'string' || !uuid.test(value.quejaId)
    || typeof value.nonce !== 'string' || !uuid.test(value.nonce)) throw invalid()
  return { quejaId: value.quejaId, nonce: value.nonce }
}

function serialized(value: PublicTrackingCapability): string {
  return JSON.stringify({ purpose: PURPOSE, queja_id: value.quejaId, nonce: value.nonce })
}

async function key(secret: string, cryptoApi: Crypto): Promise<CryptoKey> {
  return cryptoApi.subtle.importKey('raw', encoder.encode(validatePublicTrackingSecret(secret)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/**
 * La firma autentica el expediente/nonce; no concede acceso por sí sola. Cada
 * consulta/descarga debe verificar vigencia y revocación en DB. La caducidad se
 * fija allí al cerrar: el enlace y el hash del correo permanecen estables.
 */
export async function mintPublicTrackingCapability(value: PublicTrackingCapability, secret: string,
  options: CapabilityOptions = {}): Promise<string> {
  const checked = claims(value)
  const payload = base64url(encoder.encode(serialized(checked)))
  const cryptoApi = options.crypto ?? crypto
  const signature = await cryptoApi.subtle.sign('HMAC', await key(secret, cryptoApi), encoder.encode(`${PURPOSE}\0${payload}`))
  return `${payload}.${base64url(new Uint8Array(signature))}`
}

/** Autentica la capacidad; el llamador debe comprobar el acceso vigente en DB. */
export async function verifyPublicTrackingCapability(token: unknown, secret: string,
  options: CapabilityOptions = {}): Promise<PublicTrackingCapability> {
  try {
    if (typeof token !== 'string' || token.length > 1024 || token.split('.').length !== 2) throw invalid()
    const [payload, signed] = token.split('.')
    const signature = unbase64url(signed)
    if (signature.byteLength !== 32) throw invalid()
    const cryptoApi = options.crypto ?? crypto
    // Web Crypto comprueba la firma sin una comparación de strings dependiente de sus bytes.
    if (!await cryptoApi.subtle.verify('HMAC', await key(secret, cryptoApi), signature,
      encoder.encode(`${PURPOSE}\0${payload}`))) throw invalid()
    const decoded = decoder.decode(unbase64url(payload))
    const wire = JSON.parse(decoded) as Record<string, unknown>
    if (!wire || typeof wire !== 'object' || Array.isArray(wire) || wire.purpose !== PURPOSE) throw invalid()
    const value = claims({ quejaId: wire.queja_id, nonce: wire.nonce } as PublicTrackingCapability)
    // Re-serializar también rechaza claves extra, claves duplicadas y representaciones ambiguas.
    if (serialized(value) !== decoded) throw invalid()
    return value
  } catch { throw invalid() }
}

export function buildPublicTrackingUrl(origin: string, token: string,
  options: { allowLocalHttp?: boolean } = {}): string {
  let url: URL
  try { url = new URL(origin) } catch { throw invalid() }
  const local = options.allowLocalHttp === true && url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash
    || url.pathname !== '/' || (!local && url.port) || origin !== url.origin
    || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw invalid()
  return `${url.origin}/q/seguimiento#clave=${token}`
}
