import { supabase } from '@/lib/supabase'
import type { Queja } from '@/lib/types'
import type { SACP } from '@/lib/queries/useSACP'

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data as T
}

export function crearQuejaInterna(input: {
  clienteNombre: string
  emailCliente: string
  categoria: string
  descripcion: string
  prioridad: string
}) {
  return callRpc<Queja>('crear_queja_interna', {
    p_cliente_nombre: input.clienteNombre,
    p_email_cliente: input.emailCliente,
    p_categoria: input.categoria,
    p_descripcion: input.descripcion,
    p_prioridad: input.prioridad,
  })
}

export function actualizarDetallesQueja(input: {
  quejaId: string
  categoria?: string
  prioridad?: string
  responsableId?: string
  notas?: string
}) {
  return callRpc<Queja>('actualizar_detalles_queja', {
    p_queja_id: input.quejaId,
    p_categoria: input.categoria ?? null,
    p_prioridad: input.prioridad ?? null,
    p_responsable_id: input.responsableId ?? null,
    p_notas: input.notas ?? null,
  })
}

export function transicionarQueja(quejaId: string, nuevoEstado: string, resolucion: string | null = null) {
  return callRpc<Queja>('transicionar_queja', {
    p_queja_id: quejaId,
    p_nuevo_estado: nuevoEstado,
    p_resolucion: resolucion?.trim() || null,
  })
}

export function derivarQuejaASACP(quejaId: string) {
  return callRpc<SACP>('derivar_queja_a_sacp', { p_queja_id: quejaId })
}

export function agregarComentarioQueja(input: {
  quejaId: string
  comentario: string
  tipo: 'interno' | 'cliente'
  visibleCliente: boolean
}) {
  return callRpc('agregar_comentario_queja', {
    p_queja_id: input.quejaId,
    p_comentario: input.comentario.trim(),
    p_tipo: input.tipo,
    p_visible_cliente: input.visibleCliente,
  })
}
