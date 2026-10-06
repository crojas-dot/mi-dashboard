import { createHttpError } from '@/lib/errors/httpError'
import { validarTamanoAdjunto } from '@/lib/constants/adjuntos'
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
  revision: number
  categoria?: string
  prioridad?: string
  responsableId?: string
  notas?: string
}) {
  return callRpc<Queja>('qms_update_details', {
    p_id: input.quejaId,
    p_expected: input.revision,
    p_categoria: input.categoria ?? null,
    p_prioridad: input.prioridad ?? null,
    p_owner: input.responsableId ?? null,
    p_notes: input.notas ?? null,
  })
}

export interface TransicionQuejaParams {
  revision: number
  resolucion?: string | null
  justificacionProcede?: string | null
  responsableId?: string | null
  motivoReapertura?: string | null
}

export function transicionarQueja(quejaId: string, nuevoEstado: string, params: TransicionQuejaParams) {
  return callRpc<Queja>('qms_transition', {
    p_id: quejaId,
    p_expected: params.revision,
    p_state: nuevoEstado,
    p_resolution: params.resolucion?.trim() || null,
    p_justification: params.justificacionProcede?.trim() || null,
    p_owner: params.responsableId ?? null,
    p_reopen: params.motivoReapertura?.trim() || null,
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

export function reabrirQueja(quejaId: string, motivo: string, revision: number) {
  return transicionarQueja(quejaId, 'investigation', { revision, motivoReapertura: motivo })
}

export async function subirAdjuntoQueja(quejaId: string, file: File): Promise<QuejaAdjunto> {
  validarTamanoAdjunto(file)
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
    throw createHttpError(res.status, detalle, 'No se pudo subir el archivo a Google Drive')
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

export async function eliminarAdjuntoQueja(adjuntoId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  const res = await fetch('/api/drive/delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ adjuntoId }),
  })
  if (!res.ok) {
    let detalle = ''
    try {
      detalle = (await res.json())?.error ?? ''
    } catch {
      detalle = ''
    }
    throw createHttpError(res.status, detalle, 'No se pudo eliminar el adjunto')
  }
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
    throw createHttpError(res.status, detalle, 'No se pudo descargar el archivo')
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
