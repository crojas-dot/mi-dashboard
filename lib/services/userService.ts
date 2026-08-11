import { supabase } from '@/lib/supabase'
interface User { id: string; email: string; nombre: string; rol: string; activo: boolean }

export async function listarUsuarios(): Promise<User[]> {
  const { data } = await supabase.from('usuarios').select('*')
  return (data as User[]) ?? []
}

export async function actualizarUsuario(id: string, updates: Partial<User>) {
  await supabase.from('usuarios').update(updates).eq('id', id)
}
