import 'server-only'

export class PublicFormsUnavailableError extends Error {
  readonly status = 503
  readonly code = 'public_forms_unavailable'
  constructor() { super('El servicio público no está disponible') }
}

type PublicFormsEnvironment = { [key: string]: string | undefined; PUBLIC_FORMS_ENABLED?: string; PUBLIC_FORMS_SIGNING_SECRET?: string }

export function requirePublicSigningSecret(secret: unknown): string {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32 || secret.trim() !== secret) {
    throw new PublicFormsUnavailableError()
  }
  return secret
}

export function getPublicFormsConfig(environment: PublicFormsEnvironment = process.env): { signingSecret: string } {
  // Un valor mal escrito del interruptor falla cerrado, igual que un secreto ausente.
  if (environment.PUBLIC_FORMS_ENABLED !== undefined && environment.PUBLIC_FORMS_ENABLED !== 'true') {
    throw new PublicFormsUnavailableError()
  }
  return { signingSecret: requirePublicSigningSecret(environment.PUBLIC_FORMS_SIGNING_SECRET) }
}
