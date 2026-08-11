import { supabase } from '@/lib/supabase'
interface SACP { id: string; folio?: string; tipo: string; descripcion: string; estado: string; prioridad?: string; fecha_limite?: string; responsable_id?: string; seguimiento_porcentaje?: number; eficacia?: string; notas?: string; fecha_apertura?: string; origen?: string; origen_id?: string }

export async function listarSACP(): Promise<SACP[]> {
  const { data } = await supabase.from('acciones').select('*')
  return (data as SACP[]) ?? []
}

export async function crearSACP(input: Partial<SACP>): Promise<SACP | null> {
  const { data } = await supabase.from('acciones').insert([input]).select().single()
  return data as SACP | null
}

export async function actualizarSACP(id: string, updates: Partial<SACP>) {
  await supabase.from('acciones').update(updates).eq('id', id)
}
