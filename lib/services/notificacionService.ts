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

export const NOTIFICACIONES_VISIBLES = 15

export interface BandejaNotificaciones {
  items: Notificacion[]
  total: number
  sinLeer: number
}

export async function listarNotificaciones(userId: string, signal?: AbortSignal): Promise<BandejaNotificaciones> {
  const query = supabase
    .from('notificaciones')
    .select('id, usuario_id, fecha, tipo, mensaje, leida, enlace, origen_id', { count: 'exact' })
    .eq('usuario_id', userId)
    .eq('archivada', false)
    .order('fecha', { ascending: false })
    .order('id', { ascending: false }).limit(NOTIFICACIONES_VISIBLES)
  const { data, error, count } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  const items = (data as Notificacion[]) ?? []
  const total = count ?? items.length
  if (total <= items.length) return { items, total, sinLeer: items.filter(item => !item.leida).length }

  // La segunda lectura solo se necesita si hay avisos fuera del menú. Trae
  // el conteo, sin descargar mensajes ni limitar la campana a las primeras filas.
  const unread = supabase.from('notificaciones').select('id', { count: 'exact', head: true })
    .eq('usuario_id', userId).eq('archivada', false).eq('leida', false)
  const result = await (signal ? unread.abortSignal(signal) : unread)
  if (result.error) throw result.error
  return { items, total, sinLeer: result.count ?? 0 }
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
