import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function getAuthToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

export async function getCurrentUser(request: NextRequest): Promise<{ auth_id: string; rol: string; email: string } | null> {
  const token = getAuthToken(request)
  if (!token) return null

  const client = createClient(url!, anonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null

  const { data: perfil, error: perfilError } = await client
    .from('usuarios')
    .select('id, rol, email')
    .eq('auth_id', data.user.id)
    .maybeSingle()

  if (perfilError || !perfil) return null

  return { auth_id: data.user.id, rol: perfil.rol, email: perfil.email }
}
