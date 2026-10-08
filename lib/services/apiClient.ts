import { supabase } from '@/lib/supabase'

/** Transportar el token local; la API sigue verificando identidad y permisos. */
export async function apiFetch(url: string, options: RequestInit = {}) {
  options.signal?.throwIfAborted()
  const { data } = await supabase.auth.getSession()
  options.signal?.throwIfAborted()
  const token = data.session?.access_token
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}
