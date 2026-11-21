export const ACCESS_PASSWORD_MIN = 8
export const ACCESS_PASSWORD_MAX = 128
export const REPLACEMENT_PASSWORD_MIN = 12
export const REPLACEMENT_PASSWORD_MAX_BYTES = 72

export function isValidReplacementPassword(value: string) {
  return value.trim().length > 0 && Array.from(value).length >= REPLACEMENT_PASSWORD_MIN
    && new TextEncoder().encode(value).length <= REPLACEMENT_PASSWORD_MAX_BYTES
}
