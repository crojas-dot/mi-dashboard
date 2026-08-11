import { supabase } from '@/lib/supabase'

export interface PerfilUsuario {
  id: string
  email: string
  nombre: string
  rol: string
  estado: string
  notif_habilitadas?: boolean
  notif_sonido?: boolean
  notif_sonido_id?: string
}

export interface LoginResult {
  error?: string
  user?: PerfilUsuario
}

export async function signIn(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) return { error: `Error de conexión (${error.message})` }

  const user = await getAppUser(data.user.id)
  if (!user) return { error: 'No se encontró tu perfil en el sistema. Contacta al administrador.' }
  if (user.estado !== 'activo') {
    return { error: 'Tu cuenta está inactiva. Contacta al administrador.' }
  }

  return { user }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getAppUser(authId: string): Promise<PerfilUsuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, rol, estado, notif_habilitadas, notif_sonido, notif_sonido_id')
    .eq('auth_id', authId)
    .maybeSingle()
  if (error || !data) return null
  return data as PerfilUsuario
}
