import { supabase } from '@/lib/supabase'
import type { Queja } from '@/lib/types'
import type { SACP } from '@/lib/queries/useSACP'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'

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

export interface TransicionQuejaParams {
  resolucion?: string | null
  justificacionProcede?: string | null
  responsableId?: string | null
  motivoReapertura?: string | null
}

export function transicionarQueja(quejaId: string, nuevoEstado: string, params: TransicionQuejaParams = {}) {
  return callRpc<Queja>('transicionar_queja', {
    p_queja_id: quejaId,
    p_nuevo_estado: nuevoEstado,
    p_resolucion: params.resolucion?.trim() || null,
    p_justificacion_procede: params.justificacionProcede?.trim() || null,
    p_responsable_id: params.responsableId ?? null,
    p_motivo_reapertura: params.motivoReapertura?.trim() || null,
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

export function reabrirQueja(quejaId: string, motivo: string) {
  return callRpc<Queja>('reabrir_queja', {
    p_queja_id: quejaId,
    p_motivo: motivo.trim(),
  })
}

export async function subirAdjuntoQueja(quejaId: string, file: File): Promise<QuejaAdjunto> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  const formData = new FormData()
  formData.append('file', file)
  formData.append('queja_id', quejaId)

  const res = await fetch('/api/drive/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })
  if (!res.ok) {
    let detalle = ''
    try {
      detalle = (await res.json())?.error ?? ''
    } catch {
      detalle = ''
    }
    throw new Error(detalle || `No se pudo subir el archivo a Google Drive (HTTP ${res.status})`)
  }
  const { drive_file_id: driveFileId } = (await res.json()) as { drive_file_id: string }

  return callRpc<QuejaAdjunto>('registrar_adjunto_queja', {
    p_queja_id: quejaId,
    p_nombre: file.name,
    p_storage_path: driveFileId,
    p_tamano: file.size,
    p_tipo_mime: file.type || 'application/octet-stream',
  })
}

export async function descargarAdjuntoQueja(adjunto: QuejaAdjunto): Promise<void> {
  if (adjunto.storage_path.includes('/')) {
    const { data, error } = await supabase.storage
      .from('quejas-adjuntos')
      .createSignedUrl(adjunto.storage_path, 60)
    if (error || !data?.signedUrl) throw error ?? new Error('No se pudo generar el enlace de descarga')
    window.open(data.signedUrl, '_blank')
    return
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const res = await fetch(`/api/drive/download?id=${encodeURIComponent(adjunto.storage_path)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    let detalle = ''
    try {
      detalle = (await res.json())?.error ?? ''
    } catch {
      detalle = ''
    }
    throw new Error(detalle || `No se pudo descargar el archivo (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = adjunto.nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
