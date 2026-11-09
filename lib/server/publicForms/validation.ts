import 'server-only'
import { createHash } from 'node:crypto'
import type { PublicCategory } from '@/lib/constants/publicForms'
import { PublicQuejaValidationError, validatePublicQuejaDraft, type PublicQuejaField } from '@/lib/utils/publicQuejaValidation'

export class PublicFormsInputError extends Error {
  constructor(public readonly status = 400, public readonly code = 'invalid_public_request', public readonly field?: PublicQuejaField) {
    super('La solicitud pública no es válida')
  }
}

const PUBLIC_FIELDS = new Set(['formToken', 'submissionId', 'honeypot', 'nombre', 'email', 'telefono', 'categoria', 'descripcion'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SUBMISSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }

export function validateFormToken(value: unknown): string {
  // El productor de formularios conserva UUID sin guiones: no aceptar tokens de otra forma.
  if (typeof value !== 'string' || !/^[0-9a-f]{32}$/.test(value)) throw new PublicFormsInputError()
  return value
}

export interface NormalizedPublicSubmission {
  formToken: string
  submissionId: string
  honeypot: string
  nombre: string
  email: string
  telefono: string
  categoria: PublicCategory
  descripcion: string
}

export function requirePublicObject(value: unknown, allowed: ReadonlySet<string>): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublicFormsInputError()
  const object = value as Record<string, unknown>
  if (Object.keys(object).some(key => !allowed.has(key))) throw new PublicFormsInputError()
  return object
}

export function validatePublicSubmission(value: unknown): NormalizedPublicSubmission {
  const object = requirePublicObject(value, PUBLIC_FIELDS)
  const formToken = validateFormToken(object.formToken)
  if (typeof object.submissionId !== 'string' || !SUBMISSION_UUID.test(object.submissionId)) throw new PublicFormsInputError()
  if (object.honeypot !== undefined && object.honeypot !== '') throw new PublicFormsInputError(403, 'honeypot_rejected')
  try {
    const draft = validatePublicQuejaDraft(object)
    return { formToken, submissionId: object.submissionId.toLowerCase(), honeypot: '', ...draft }
  } catch (error) {
    if (error instanceof PublicQuejaValidationError) throw new PublicFormsInputError(400, error.code, error.field)
    throw error
  }
}

export function hashPublicPayload(formId: string, input: NormalizedPublicSubmission): string {
  if (!isUuid(formId)) throw new PublicFormsInputError()
  // Solo el contenido normalizado y el formulario persistido definen un mismo envío lógico.
  return createHash('sha256').update(JSON.stringify([
    'qms-public-submission-v1', formId.toLowerCase(), input.nombre, input.email, input.telefono, input.categoria, input.descripcion,
  ])).digest('hex')
}

export function validatePublicFinalization(value: unknown): string {
  const object = requirePublicObject(value, new Set(['uploadToken']))
  if (typeof object.uploadToken !== 'string' || !object.uploadToken || object.uploadToken.length > 2048) throw new PublicFormsInputError()
  return object.uploadToken
}
