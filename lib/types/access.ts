export type AccessMethod = 'totp' | 'email'
export interface AccessStatus {
  managed: boolean
  phase: 'ready' | 'blocked' | 'password' | 'enroll' | 'verify' | 'locked' | 'reset_pending'
  requireMfa?: boolean
  method?: AccessMethod | null
  maskedEmail?: string | null
  blockedUntil?: string | null
  generation?: number
}
export interface UserAccessSetup { id: string; invite: boolean; requireMfa: boolean }
export interface UserAccessDirectory {
  authId: string; requireMfa: boolean; method: AccessMethod | null
  status: 'disabled' | 'invite_pending' | 'invite_expired' | 'password_pending' | 'mfa_pending' | 'active'
  invitationFailed: boolean
}
export interface UserMutationResult {
  ok?: boolean; userId?: string; created?: boolean; tempPassword?: string
  invitation?: 'sent' | 'failed' | 'uncertain' | 'not_sent'
}
