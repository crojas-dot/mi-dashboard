const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?'

function randomIndex(size: number): number {
  const ceiling = 2 ** 32 - (2 ** 32 % size)
  const value = new Uint32Array(1)
  do { crypto.getRandomValues(value) } while (value[0] >= ceiling)
  return value[0] % size
}

export function generatePassword(length = 16): string {
  const size = Number.isSafeInteger(length) ? Math.max(8, length) : 16
  const groups = [UPPER, LOWER, DIGITS, SYMBOLS]
  const characters = groups.map(group => group[randomIndex(group.length)])
  const all = groups.join('')
  while (characters.length < size) characters.push(all[randomIndex(all.length)])
  // Fisher-Yates: cada posición se elige con Web Crypto, sin sort aleatorio.
  for (let index = characters.length - 1; index > 0; index--) {
    const target = randomIndex(index + 1)
    ;[characters[index], characters[target]] = [characters[target], characters[index]]
  }
  return characters.join('')
}
