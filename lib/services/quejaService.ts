import { supabase } from '@/lib/supabase'
import type { Queja } from '@/lib/types'

export async function crearQueja(queja: Omit<Queja, 'id'>) {
  const { data, error } = await supabase
    .from('quejas')
    .insert([queja])
    .select()

  if (error) {
    console.error('Error completo:', JSON.stringify(error, null, 2))
    console.error('Mensaje:', error.message)
    console.error('Código:', error.code)
    console.error('Detalles:', error.details)
    throw error
  }
  return data
}

export async function actualizarQueja(id: string, updates: Partial<Queja>) {
  const { data, error } = await supabase
    .from('quejas')
    .update(updates)
    .eq('id', id)
    .select()
  if (error) { console.error('Error al actualizar queja:', error); throw error }
  return data
}

export async function obtenerQuejas() {
  const { data, error } = await supabase
    .from('quejas')
    .select('*')
    .order('fecha', { ascending: false })
  if (error) { console.error('Error al obtener quejas:', error); throw error }
  return data as Queja[]
}
