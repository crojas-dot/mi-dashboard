import { supabase } from '@/lib/supabase'
interface Proceso { id: string; codigo: string; nombre: string; descripcion?: string; responsable_id?: string; estado: string; diagrama?: string }

export async function listarProcesos(): Promise<Proceso[]> {
  const { data } = await supabase.from('procesos').select('*')
  return (data as Proceso[]) ?? []
}

export async function crearProceso(input: Partial<Proceso>): Promise<Proceso | null> {
  const { data } = await supabase.from('procesos').insert([input]).select().single()
  return data as Proceso | null
}
