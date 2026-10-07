import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

interface PerfilConAcceso {
  auth_id?: string | null
  ultimo_acceso?: string | null
}

/** Auth es la fuente del último inicio de sesión; nunca devolver sus otros campos. */
export async function completarUltimoAcceso<T extends PerfilConAcceso>(admin: SupabaseClient, perfiles: T[]): Promise<T[]> {
  const pendientes = new Set(perfiles.map(perfil => perfil.auth_id).filter((id): id is string => !!id))
  if (pendientes.size === 0) return perfiles

  const accesos = new Map<string, string | null>()
  const perPage = 1000
  for (let page = 1; pendientes.size > 0; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    for (const usuario of data.users) {
      if (!pendientes.delete(usuario.id)) continue
      accesos.set(usuario.id, usuario.last_sign_in_at ?? null)
    }
    if (data.users.length < perPage) break
  }
  return perfiles.map(perfil => ({ ...perfil, ultimo_acceso: perfil.auth_id ? accesos.get(perfil.auth_id) ?? null : perfil.ultimo_acceso ?? null }))
}
