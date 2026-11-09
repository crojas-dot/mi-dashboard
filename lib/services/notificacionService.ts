import { supabase } from '@/lib/supabase'

export interface Notificacion {
  id: string
  usuario_id: string
  fecha: string
  tipo: string
  mensaje: string
  leida: boolean
  archivada?: boolean
  enlace?: string
  origen_id?: string
}

export async function listarNotificaciones(userId: string, signal?: AbortSignal): Promise<Notificacion[]> {
  const query = supabase
    .from('notificaciones')
    .select('*')
    .eq('usuario_id', userId)
    .eq('archivada', false)
    .order('fecha', { ascending: false })
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return (data as Notificacion[]) ?? []
}

export async function marcarLeida(id: string) {
  // Una fila oculta por RLS tampoco confirma un guardado individual.
  const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id).select('id').single()
  if (error) throw error
}

export async function marcarTodasLeidas(userId: string) {
  const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', userId).eq('leida', false).eq('archivada', false)
  if (error) throw error
}

export async function archivarNotificacion(id: string) {
  const { error } = await supabase.from('notificaciones').update({ archivada: true }).eq('id', id).select('id').single()
  if (error) throw error
}

export async function archivarTodasVisibles(userId: string) {
  const { error } = await supabase.from('notificaciones').update({ archivada: true }).eq('usuario_id', userId).eq('archivada', false)
  if (error) throw error
}
