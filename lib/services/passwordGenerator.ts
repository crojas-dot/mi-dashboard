const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?'

function pick(chars: string, count: number): string {
  let result = ''
  const array = new Uint32Array(count)
  crypto.getRandomValues(array)
  for (let i = 0; i < count; i++) {
    result += chars[array[i] % chars.length]
  }
  return result
}

export function generatePassword(length = 16): string {
  if (length < 8) length = 8
  const all = UPPER + LOWER + DIGITS + SYMBOLS
  const upper = pick(UPPER, 1)
  const lower = pick(LOWER, 1)
  const digit = pick(DIGITS, 1)
  const symbol = pick(SYMBOLS, 1)
  const rest = pick(all, length - 4)
  const combined = upper + lower + digit + symbol + rest
  const shuffled = combined
    .split('')
    .sort(() => crypto.getRandomValues(new Uint32Array(1))[0] / (2 ** 32 - 1) - 0.5)
    .join('')
  return shuffled
}