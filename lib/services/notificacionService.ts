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

export async function listarNotificaciones(userId: string): Promise<Notificacion[]> {
  const { data } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('usuario_id', userId)
    .eq('archivada', false)
    .order('fecha', { ascending: false })
  return (data as Notificacion[]) ?? []
}

export async function crearNotificacion(input: {
  usuario_id: string
  tipo: string
  mensaje: string
  enlace?: string
  origen_id?: string
}): Promise<Notificacion | null> {
  const { data, error } = await supabase
    .from('notificaciones')
    .insert([{
      usuario_id: input.usuario_id,
      fecha: new Date().toISOString(),
      tipo: input.tipo,
      mensaje: input.mensaje,
      leida: false,
      enlace: input.enlace ?? null,
      origen_id: input.origen_id ?? null,
    }])
    .select()
    .single()
  if (error) {
    console.error('Error al crear notificación:', error)
    return null
  }
  return (data as Notificacion) ?? null
}

export async function marcarLeida(id: string) {
  await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
}

export async function marcarTodasLeidas(userId: string) {
  await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', userId).eq('leida', false).eq('archivada', false)
}

export async function archivarNotificacion(id: string) {
  await supabase.from('notificaciones').update({ archivada: true }).eq('id', id)
}

export async function archivarTodasVisibles(userId: string) {
  await supabase.from('notificaciones').update({ archivada: true }).eq('usuario_id', userId).eq('archivada', false)
}
