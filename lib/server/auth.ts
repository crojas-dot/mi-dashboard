import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function getAuthToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

export function createAuthenticatedClient(request: NextRequest, signal?: AbortSignal) {
  const token = getAuthToken(request)
  if (!token) return null

  return createClient(url!, anonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      ...(signal ? { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
      }) } : {}),
      headers: { Authorization: `Bearer ${token}` },
    },
  })
}

export async function getCurrentUser(request: NextRequest, signal?: AbortSignal): Promise<{ id: string; auth_id: string; rol: string; email: string } | null> {
  const token = getAuthToken(request)
  const client = createAuthenticatedClient(request, signal)
  if (!token || !client) return null
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null

  const { data: perfil, error: perfilError } = await client
    .from('usuarios')
    .select('id, rol, email, estado')
    .eq('auth_id', data.user.id)
    .maybeSingle()

  if (perfilError || !perfil || perfil.estado !== 'activo') return null

  return { id: perfil.id, auth_id: data.user.id, rol: perfil.rol, email: perfil.email }
}
