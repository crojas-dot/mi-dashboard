import { supabase } from '@/lib/supabase'
import { fetchAccessStatus } from '@/lib/services/accessClient'
import type { AccessStatus } from '@/lib/types/access'

export interface PerfilUsuario {
  id: string
  email: string
  nombre: string
  rol: string
  estado: string
  avatar_url?: string | null
  notif_habilitadas?: boolean
  notif_sonido?: boolean
  notif_sonido_id?: string
}

export interface LoginResult {
  error?: string
  user?: PerfilUsuario
  authId?: string
  access?: AccessStatus
  accessManaged?: boolean
}

export async function signIn(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) return { error: error.status === 429 ? 'Esperá un momento antes de volver a intentar.'
    : error.code === 'invalid_credentials' ? 'Revisá el correo y la contraseña.'
      : 'No se pudo iniciar sesión. Si tu contraseña temporal venció, contactá a la administración.' }

  const access=await fetchAccessStatus()
  if(access.phase==='blocked')return {error:'Tu cuenta está inactiva. Contactá al administrador.'}
  if(access.phase!=='ready')return {access,authId:data.user.id}

  const user = await getAppUser(data.user.id)
  if (!user) return { error: 'No se encontró tu perfil en el sistema. Contacta al administrador.' }
  if (user.estado !== 'activo') {
    return { error: 'Tu cuenta está inactiva. Contacta al administrador.' }
  }

  return { user, authId: data.user.id, access, accessManaged: access.managed }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getAppUser(authId: string): Promise<PerfilUsuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, rol, estado, avatar_url, notif_habilitadas, notif_sonido, notif_sonido_id')
    .eq('auth_id', authId)
    .maybeSingle()
  if (error || !data) return null
  return data as PerfilUsuario
}
