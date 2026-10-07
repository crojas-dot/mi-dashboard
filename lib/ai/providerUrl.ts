const BASE_URL_ALLOWLIST = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'openrouter.ai',
  'api.groq.com',
  'generativelanguage.googleapis.com',
  'api.deepseek.com',
  'api.mistral.ai',
  'api.together.xyz',
])

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/i,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fd00:/i,
]

export function validarBaseUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.port && parsed.port !== '443')) return false
  const hostname = parsed.hostname.toLowerCase()
  if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) return false
  if (hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '169.254.169.254') return false
  return BASE_URL_ALLOWLIST.has(hostname)
}

