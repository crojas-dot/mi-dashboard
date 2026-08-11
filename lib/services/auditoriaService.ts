import { supabase } from '@/lib/supabase'
interface Auditoria { id: string; titulo: string; tipo: string; alcance?: string; fecha_inicio?: string; fecha_fin?: string; estado: string }
interface Hallazgo { id: string; auditoria_id: string; descripcion: string; tipo: string; derivado_sacp_id?: string }

export async function listarAuditorias(): Promise<Auditoria[]> {
  const { data } = await supabase.from('auditorias').select('*')
  return (data as Auditoria[]) ?? []
}

export async function crearAuditoria(input: Partial<Auditoria>): Promise<Auditoria | null> {
  const { data } = await supabase.from('auditorias').insert([input]).select().single()
  return data as Auditoria | null
}

export async function listarHallazgos(auditoriaId: string): Promise<Hallazgo[]> {
  const { data } = await supabase.from('hallazgos').select('*').eq('auditoria_id', auditoriaId)
  return (data as Hallazgo[]) ?? []
}
