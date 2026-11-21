import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { getAuthToken } from '@/lib/server/auth'

export async function getAccessIdentity(request: NextRequest) {
  const token = getAuthToken(request)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !key) return null
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  // No consulta el perfil por Data API: todavía puede estar bloqueado por el alta.
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  const result = await client.auth.getClaims(token)
  const claims = result.data?.claims
  if (result.error || claims?.sub !== data.user.id || typeof claims.session_id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)) return null
  const passwordAuthenticated = Array.isArray(claims.amr) && claims.amr.some(entry =>
    typeof entry === 'object' && entry !== null && entry.method === 'password'
  )
  return { id: data.user.id, sessionId: claims.session_id, aal: String(claims.aal ?? 'aal1'), passwordAuthenticated, email: data.user.email ?? '', token, client }
}
export type AccessIdentity = NonNullable<Awaited<ReturnType<typeof getAccessIdentity>>>
