import { supabase } from '@/lib/supabase'
interface Reunion { id: string; titulo: string; fecha: string; asistentes?: string[]; agenda?: string; estado: string; acta?: string }

export async function listarReuniones(): Promise<Reunion[]> {
  const { data } = await supabase.from('reuniones').select('*')
  return (data as Reunion[]) ?? []
}

export async function crearReunion(input: Partial<Reunion>): Promise<Reunion | null> {
  const { data } = await supabase.from('reuniones').insert([input]).select().single()
  return data as Reunion | null
}
