const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = hits.get(ip)

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs })
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
