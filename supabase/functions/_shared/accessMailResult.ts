export const ACCESS_MAIL_ERRORS = [
  'disabled', 'ledger_busy', 'quota_exhausted', 'event_conflict', 'access_mail_unavailable', 'delivery_uncertain', 'provider_rejected', 'login_origin_mismatch', 'invalid_access_payload',
] as const

export type AccessMailCode = (typeof ACCESS_MAIL_ERRORS)[number]
export type AccessMailOutcome = 'sent' | 'failed' | 'uncertain'

export function isAccessMailCode(value: unknown): value is AccessMailCode {
  return (ACCESS_MAIL_ERRORS as readonly unknown[]).includes(value)
}
