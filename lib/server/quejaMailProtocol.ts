import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export type MailPurpose = 'worker_request' | 'worker_receipt' | 'delivery_request' | 'delivery_receipt' | 'queue_wake_request' | 'queue_wake_receipt'
export interface QuejaMailEnvelope {
  version: 1
  purpose: MailPurpose
  issuedAt: number
  nonce: string
  payload: string
  signature: string
}
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ENVELOPE_KEYS = ['version', 'purpose', 'issuedAt', 'nonce', 'payload', 'signature']

export class QuejaMailProtocolError extends Error {
  constructor(public readonly code = 'invalid_mail_envelope') { super(code) }
}

export function isMailUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value)
}

export function mailRecord(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new QuejaMailProtocolError()
  const record = value as Record<string, unknown>
  if (keys && Object.keys(record).some(key => !keys.includes(key))) throw new QuejaMailProtocolError()
  return record
}

function signingInput(envelope: Omit<QuejaMailEnvelope, 'signature'>) {
  // Firmar el payload codificado evita diferencias de serialización entre Node y Apps Script.
  return `eca-qms-mail:v1:${envelope.purpose}\n${envelope.issuedAt}\n${envelope.nonce}\n${envelope.payload}`
}

export function signMailEnvelope(purpose: MailPurpose, payload: unknown, secret: string, now = Date.now()): QuejaMailEnvelope {
  const envelope = {
    version: 1 as const, purpose, issuedAt: Math.floor(now / 1000), nonce: randomUUID(),
    payload: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url'),
  }
  return { ...envelope, signature: createHmac('sha256', secret).update(signingInput(envelope)).digest('hex') }
}

export function verifyMailEnvelope(value: unknown, purpose: MailPurpose, secret: string, now = Date.now()): {
  envelope: QuejaMailEnvelope; payload: unknown
} {
  const candidate = mailRecord(value, ENVELOPE_KEYS)
  const issuedAt = candidate.issuedAt
  if (candidate.version !== 1 || candidate.purpose !== purpose || !Number.isSafeInteger(issuedAt)
    || Math.floor(now / 1000) - Number(issuedAt) > 300 || Number(issuedAt) - Math.floor(now / 1000) > 30
    || !isMailUuid(candidate.nonce) || typeof candidate.payload !== 'string'
    || !/^[A-Za-z0-9_-]+$/.test(candidate.payload) || candidate.payload.length > 32_768
    || typeof candidate.signature !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.signature)) {
    throw new QuejaMailProtocolError()
  }
  const envelope = candidate as unknown as QuejaMailEnvelope
  const expected = createHmac('sha256', secret).update(signingInput(envelope)).digest()
  if (!timingSafeEqual(expected, Buffer.from(envelope.signature, 'hex'))) throw new QuejaMailProtocolError()
  const decoded = Buffer.from(envelope.payload, 'base64url')
  if (decoded.toString('base64url') !== envelope.payload) throw new QuejaMailProtocolError()
  try { return { envelope, payload: JSON.parse(decoded.toString('utf8')) } }
  catch { throw new QuejaMailProtocolError() }
}

export async function readMailJson(request: Request, maximum = 4_096): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new QuejaMailProtocolError('invalid_mail_content_type')
  }
  if (Number(request.headers.get('content-length')) > maximum) throw new QuejaMailProtocolError('mail_body_too_large')
  const reader = request.body?.getReader()
  if (!reader) throw new QuejaMailProtocolError()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      request.signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maximum) {
        await reader.cancel()
        throw new QuejaMailProtocolError('mail_body_too_large')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new QuejaMailProtocolError() }
}
