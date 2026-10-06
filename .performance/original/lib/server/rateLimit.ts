const hits = new Map<string, { count: number; resetAt: number }>()
const MAX_ENTRIES = 10_000
let nextCleanup = 0

export function rateLimit(ip: string, limit: number, windowMs: number, scope = 'global'): boolean {
  const now = Date.now()
  if (now >= nextCleanup) {
    for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key)
    nextCleanup = now + 30_000
  }
  const key = `${scope}:${ip}`
  const entry = hits.get(key)

  if (!entry || now >= entry.resetAt) {
    if (!entry && hits.size >= MAX_ENTRIES) return false
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  entry.count++
  if (entry.count > limit) return false
  return true
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
