import { supabase } from '@/lib/supabase'
interface Documento { id: string; codigo_doc?: string; titulo: string; version_actual?: string; estado: string; fecha_publicacion?: string; categoria?: string }

export async function listarDocumentos(): Promise<Documento[]> {
  const { data } = await supabase.from('documentos').select('*')
  return (data as Documento[]) ?? []
}

export async function crearDocumento(input: Partial<Documento>): Promise<Documento | null> {
  const { data } = await supabase.from('documentos').insert([input]).select().single()
  return data as Documento | null
}

export async function actualizarDocumento(id: string, updates: Partial<Documento>) {
  await supabase.from('documentos').update(updates).eq('id', id)
}
