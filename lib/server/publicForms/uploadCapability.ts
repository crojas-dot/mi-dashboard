import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { PUBLIC_UPLOAD_TTL_SECONDS } from '@/lib/constants/publicForms'
import { getPublicFormsConfig, requirePublicSigningSecret } from '@/lib/server/publicForms/config'
import { isUuid, PublicFormsInputError } from '@/lib/server/publicForms/validation'

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'QMS-UPLOAD', v: 1 })).toString('base64url')
const CLAIMS = new Set(['purpose', 'formId', 'submissionId', 'quejaId', 'iat', 'exp'])
const SIGNATURE_DOMAIN = 'qms-public-upload-v1\0'

export interface UploadCapabilityClaims {
  purpose: 'upload'
  formId: string
  submissionId: string
  quejaId: string
  iat: number
  exp: number
}

interface UploadCapabilityInput {
  formId: string
  submissionId: string
  quejaId: string
  issuedAt?: string | number | Date
}

function signingKey(secret?: string): string {
  return requirePublicSigningSecret(secret ?? getPublicFormsConfig().signingSecret)
}

function signature(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(SIGNATURE_DOMAIN).update(data).digest()
}

function issuedSeconds(value: string | number | Date | undefined, now: number): number {
  if (value === undefined) return Math.floor(now / 1000)
  const seconds = typeof value === 'number' ? value : Math.floor(new Date(value).getTime() / 1000)
  if (!Number.isSafeInteger(seconds) || seconds < 0) throw new PublicFormsInputError()
  return seconds
}

export function issueUploadCapability(
  input: UploadCapabilityInput,
  secret?: string,
  now = Date.now(),
): { uploadToken: string; expiresAt: string } {
  const key = signingKey(secret)
  if (!Number.isFinite(now) || now < 0 || now > 8640000000000000 - PUBLIC_UPLOAD_TTL_SECONDS * 1000) throw new PublicFormsInputError()
  if (![input.formId, input.submissionId, input.quejaId].every(isUuid)) throw new PublicFormsInputError()
  const iat = issuedSeconds(input.issuedAt, now)
  if (iat > Math.floor(now / 1000)) throw new PublicFormsInputError()
  const exp = iat + PUBLIC_UPLOAD_TTL_SECONDS
  const claims: UploadCapabilityClaims = {
    purpose: 'upload', formId: input.formId.toLowerCase(), submissionId: input.submissionId.toLowerCase(),
    quejaId: input.quejaId.toLowerCase(), iat, exp,
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signed = HEADER + '.' + payload
  return { uploadToken: signed + '.' + signature(signed, key).toString('base64url'), expiresAt: new Date(exp * 1000).toISOString() }
}

function decode(segment: string): Buffer {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) throw new PublicFormsInputError(403, 'invalid_upload_capability')
  const decoded = Buffer.from(segment, 'base64url')
  if (decoded.toString('base64url') !== segment) throw new PublicFormsInputError(403, 'invalid_upload_capability')
  return decoded
}

export function verifyUploadCapability(token: unknown, secret?: string, now = Date.now()): UploadCapabilityClaims {
  const key = signingKey(secret)
  if (!Number.isFinite(now) || now < 0) throw new PublicFormsInputError(403, 'invalid_upload_capability')
  if (typeof token !== 'string' || token.length > 2048) throw new PublicFormsInputError(403, 'invalid_upload_capability')
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== HEADER) throw new PublicFormsInputError(403, 'invalid_upload_capability')
  const received = decode(parts[2])
  const expected = signature(parts[0] + '.' + parts[1], key)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new PublicFormsInputError(403, 'invalid_upload_capability')
  }
  let claims: unknown
  try { claims = JSON.parse(decode(parts[1]).toString('utf8')) }
  catch { throw new PublicFormsInputError(403, 'invalid_upload_capability') }
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) throw new PublicFormsInputError(403, 'invalid_upload_capability')
  const value = claims as Record<string, unknown>
  if (Object.keys(value).length !== CLAIMS.size || Object.keys(value).some(field => !CLAIMS.has(field))
    || value.purpose !== 'upload' || ![value.formId, value.submissionId, value.quejaId].every(isUuid)
    || typeof value.iat !== 'number' || typeof value.exp !== 'number'
    || !Number.isSafeInteger(value.iat) || !Number.isSafeInteger(value.exp) || value.iat < 0
    || value.exp - value.iat !== PUBLIC_UPLOAD_TTL_SECONDS || value.iat > Math.floor(now / 1000)) {
    throw new PublicFormsInputError(403, 'invalid_upload_capability')
  }
  if (value.exp <= Math.floor(now / 1000)) throw new PublicFormsInputError(410, 'upload_capability_expired')
  return value as unknown as UploadCapabilityClaims
}

export function hashPublicRateKey(value: string, secret?: string): string {
  if (typeof value !== 'string' || !value || value.length > 1024) throw new PublicFormsInputError()
  // El mismo secreto no permite confundir claves de cuota con firmas de capacidades.
  return createHmac('sha256', signingKey(secret)).update('qms-public-rate-ip-v1\0').update(value).digest('hex')
}
