import { supabase } from '@/lib/supabase'
interface Riesgo { id: string; titulo: string; descripcion?: string; probabilidad: number; impacto: number; nivel_riesgo?: string; plan_mitigacion?: string; responsable_id?: string; estado?: string }

export async function listarRiesgos(): Promise<Riesgo[]> {
  const { data } = await supabase.from('riesgos').select('*')
  return (data as Riesgo[]) ?? []
}

export async function crearRiesgo(input: Partial<Riesgo>): Promise<Riesgo | null> {
  const { data } = await supabase.from('riesgos').insert([input]).select().single()
  return data as Riesgo | null
}

export async function actualizarRiesgo(id: string, updates: Partial<Riesgo>) {
  await supabase.from('riesgos').update(updates).eq('id', id)
}
