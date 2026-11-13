import { MAX_FILE_BYTES, validarTamanoAdjunto } from '@/lib/constants/adjuntos'
import { supabase } from '@/lib/supabase'
import { fetchDriveBlob } from '@/lib/services/driveClient'
import type { Queja } from '@/lib/types'
import type { SACP } from '@/lib/queries/useSACP'
import type { QuejaAdjunto } from '@/lib/queries/useQuejas'
import { CODIGOS_ESTADO_QUEJA, REGISTRO_QUEJA_LIMITES, TIPOS_REGISTRO_QUEJA } from '@/lib/constants/quejas'
import { requireText, trimTextFields } from '@/lib/utils/operationalFormValidation'
import { validarCorreoQueja, type CorreoQueja } from '@/lib/utils/quejaCorreo'

type ExpedienteVersionado = Pick<Queja, 'id' | 'revision'>

function revisionEsperada(queja: ExpedienteVersionado): number {
  if (!Number.isSafeInteger(queja.revision) || queja.revision < 0) throw new Error('Actualiza el expediente antes de guardar.')
  return queja.revision
}

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
  prioridad?: string
}) {
  const values = trimTextFields(input)
  requireText(values.clienteNombre, 'Nombre')
  requireText(values.emailCliente, 'Correo electrónico')
  requireText(values.descripcion, 'Descripción')
  if (values.emailCliente.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(values.emailCliente))
    throw new Error('El correo electrónico debe ser válido, de hasta 254 caracteres.')
  if (values.clienteNombre.length > 150 || values.descripcion.length > 10000) throw new Error('Revisa la longitud del nombre y la descripción.')
  if (!(TIPOS_REGISTRO_QUEJA as readonly string[]).includes(values.categoria)) throw new Error('Seleccioná un tipo válido.')
  // Validar antes del RPC evita consumir un folio con un alta incompleta.
  return callRpc<Queja>('crear_queja_interna', {
    p_cliente_nombre: values.clienteNombre,
    p_email_cliente: values.emailCliente,
    p_categoria: values.categoria,
    p_descripcion: values.descripcion,
    // El contrato histórico conserva el parámetro; nuevas altas no usan prioridad.
    p_prioridad: values.prioridad ?? null,
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
    p_expected: revisionEsperada({ id: input.quejaId, revision: input.revision }),
    p_categoria: input.categoria ?? null,
    p_prioridad: input.prioridad ?? null,
    p_owner: input.responsableId ?? null,
    p_notes: input.notas ?? null,
  })
}

export interface TransicionQuejaParams {
  resolucion?: string | null
  justificacionProcede?: string | null
  responsableId?: string | null
  motivoReapertura?: string | null
  numeroOficio?: string | null
  resolucionFormato?: 'plain' | 'markdown'
  justificacionFormato?: 'plain' | 'markdown'
}

function resolucionBorradorArgs(queja: ExpedienteVersionado, version: number, contenido: string, formato: 'plain' | 'markdown') {
  if (!Number.isSafeInteger(version) || version < 0 || contenido.length > 10000 || !['plain', 'markdown'].includes(formato)) {
    throw new Error('Revisá el contenido y formato de la resolución antes de guardar.')
  }
  return { p_id: queja.id, p_expected: revisionEsperada(queja), p_version: version, p_content: contenido, p_format: formato }
}

/** Borrador versionado: no sustituye la propuesta enviada ni cambia el estado. */
export function guardarResolucionBorrador(queja: ExpedienteVersionado, version: number, contenido: string, formato: 'plain' | 'markdown') {
  return callRpc<import('@/lib/queries/useQuejaResolucionDraft').QuejaResolucionDraft>('qms_save_resolution_draft', resolucionBorradorArgs(queja,version,contenido,formato))
}

export function enviarResolucionBorradorRevision(queja: ExpedienteVersionado, version: number, contenido: string, formato: 'plain' | 'markdown') {
  if (!contenido.trim()) throw new Error('Escribí la resolución antes de enviarla a revisión.')
  return callRpc<Queja>('qms_submit_resolution_draft', resolucionBorradorArgs(queja,version,contenido,formato))
}

export function transicionarQueja(queja: ExpedienteVersionado, nuevoEstado: string, params: TransicionQuejaParams = {}) {
  const codigo = CODIGOS_ESTADO_QUEJA[nuevoEstado]
  if (!codigo) throw new Error('Estado no reconocido.')
  const office = params.numeroOficio?.trim() || null
  if (office && office.length > REGISTRO_QUEJA_LIMITES.oficio) throw new Error('El número de oficio es demasiado largo.')
  // La decisión, el oficio y el formato se guardan juntos con la revisión editada.
  return callRpc<Queja>('qms_transition_complaint', {
    p_id: queja.id,
    p_expected: revisionEsperada(queja),
    p_state: codigo,
    p_resolution: params.resolucion?.trim() || null,
    p_justification: params.justificacionProcede?.trim() || null,
    p_owner: params.responsableId ?? null,
    p_reopen: params.motivoReapertura?.trim() || null,
    p_office_number: office,
    p_resolution_format: params.resolucion != null ? params.resolucionFormato ?? 'plain' : null,
    p_justification_format: params.justificacionProcede != null ? params.justificacionFormato ?? 'plain' : null,
  })
}

/** Solo adjuntos institucionales del expediente; las evidencias ciudadanas siguen privadas. */
export function esOficioPublicableQueja(adjunto: QuejaAdjunto | null | undefined, quejaId: string): adjunto is QuejaAdjunto {
  return !!adjunto && adjunto.queja_id === quejaId && typeof adjunto.usuario_id === 'string' && !!adjunto.usuario_id
    && typeof adjunto.storage_path === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(adjunto.storage_path)
    && Number.isSafeInteger(adjunto.tamano) && adjunto.tamano > 0 && adjunto.tamano <= MAX_FILE_BYTES
    && typeof adjunto.nombre === 'string' && adjunto.nombre.trim().length > 0 && adjunto.nombre.length <= 255 && !/[\u0000-\u001f\u007f/\\]/.test(adjunto.nombre)
    && typeof adjunto.tipo_mime === 'string' && adjunto.tipo_mime.length <= 127 && /^[A-Za-z0-9][A-Za-z0-9.+_-]*\/[A-Za-z0-9][A-Za-z0-9.+_-]*$/.test(adjunto.tipo_mime)
    && typeof adjunto.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(adjunto.id)
}

export interface PublicacionQuejaInput {
  estado: 'No Procede' | 'Resuelto'
  respuestaPublica: string
  numeroOficio: string
  adjunto: QuejaAdjunto | null
  resolucion?: string | null
  resolucionFormato?: 'plain' | 'markdown'
}

export function resolverQuejaConDocumento(queja: ExpedienteVersionado, input: PublicacionQuejaInput) {
  const revision = revisionEsperada(queja)
  const state = input.estado === 'No Procede' ? 'rejected' : input.estado === 'Resuelto' ? 'resolved' : null
  if (!state) throw new Error('Seleccioná un resultado válido para publicar.')
  const respuesta = input.respuestaPublica.trim()
  const oficio = input.numeroOficio.trim()
  if (!respuesta || respuesta.length > 10000) throw new Error('Escribí la respuesta al cliente, de hasta 10.000 caracteres.')
  if (!oficio || oficio.length > REGISTRO_QUEJA_LIMITES.oficio) throw new Error('Registrá un número de oficio válido antes de publicar.')
  if (!esOficioPublicableQueja(input.adjunto, queja.id)) throw new Error('Seleccioná el oficio adjunto de este expediente antes de publicar.')
  const resolution = input.resolucion?.trim()
  if (resolution && resolution.length > 10000) throw new Error('La resolución interna no puede superar los 10.000 caracteres.')
  // Publicación y transición son una sola escritura CAS. La DB vuelve a comprobar
  // rol real, revisión, pertenencia del archivo y contenido permitido.
  return callRpc<Queja>('qms_resolve_complaint_with_document', {
    p_queja_id: queja.id, p_estado: state, p_expected_revision: revision,
    p_detalles: { ...(resolution ? { resolution, resolution_format: input.resolucionFormato ?? 'plain' } : {}), office_number: oficio },
    p_adjunto_id: input.adjunto.id, p_respuesta_publica: respuesta,
  })
}

export interface RegistroQuejaInput {
  quejaId: string
  revision: number
  area: string
  numeroOficio: string
  observaciones: string
}

export function revisarResolucionQueja(queja: ExpedienteVersionado, decision: 'approved' | 'returned', motivo?: string, adjuntoIds: string[] = []) {
  const revision = revisionEsperada(queja)
  if (decision !== 'approved' && decision !== 'returned') throw new Error('Seleccioná una decisión válida.')
  if (decision === 'returned' && (!motivo?.trim() || motivo.trim().length > 10000)) throw new Error('Escribí el motivo de devolución, de hasta 10.000 caracteres.')
  if (decision === 'returned') return callRpc<Queja>('qms_review_resolution_with_attachments', {
    p_id: queja.id, p_expected: revision, p_motivo: motivo!.trim(), p_adjuntos: adjuntoIds,
  })
  return callRpc<Queja>('qms_review_resolution', { p_id: queja.id, p_expected: revision, p_decision: decision, p_motivo: null })
}

export interface RespuestaClienteDraftInput { respuesta: string; numeroOficio: string; adjuntoId: string | null; correo?: CorreoQueja; noProcede?: { justificacion: string; formato: 'plain' | 'markdown' } }

function rechazoArgs(input: RespuestaClienteDraftInput, required = false) {
  const reason = input.noProcede
  if (!reason || !['plain', 'markdown'].includes(reason.formato) || reason.justificacion.length > 10000 || required && !reason.justificacion.trim()) throw new Error('Revisá la justificación de no procedencia.')
  if (!input.correo) throw new Error('Revisá el asunto y el mensaje del correo.')
  validarCorreoQueja(input.correo, required)
  return { p_reason: reason.justificacion.trim(), p_reason_format: reason.formato, p_email_subject: input.correo.asunto.trim(), p_email_body: input.correo.cuerpo.trim() }
}

function respuestaArgs(queja: ExpedienteVersionado, version: number, input: RespuestaClienteDraftInput) {
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('Actualizá el borrador antes de guardar.')
  const respuesta = input.respuesta.trim(), office = input.numeroOficio.trim()
  if (respuesta.length > 10000 || office.length > REGISTRO_QUEJA_LIMITES.oficio || /[\u0000-\u001f\u007f]/.test(office)) throw new Error('Revisá la extensión de la respuesta y el número de oficio.')
  return { p_id: queja.id, p_expected: revisionEsperada(queja), p_version: version, p_response: respuesta,
    p_office: office, p_file: input.adjuntoId || null }
}

export function guardarRespuestaClienteBorrador(queja: ExpedienteVersionado, version: number, input: RespuestaClienteDraftInput) {
  const args = respuestaArgs(queja, version, input)
  if (input.noProcede) return callRpc<import('@/lib/queries/useQuejaRespuestaCliente').RespuestaClienteDraft>('qms_save_rejected_response_draft', { ...args, ...rechazoArgs(input) })
  if (input.correo) {
    validarCorreoQueja(input.correo)
    Object.assign(args, { p_email_subject: input.correo.asunto.trim(), p_email_body: input.correo.cuerpo.trim() })
  }
  return callRpc<import('@/lib/queries/useQuejaRespuestaCliente').RespuestaClienteDraft>(input.correo ? 'qms_save_response_draft_v2' : 'qms_save_response_draft', args)
}

export function publicarRespuestaAprobada(queja: ExpedienteVersionado, version: number, input: RespuestaClienteDraftInput, adjunto: QuejaAdjunto | null) {
  const args = respuestaArgs(queja, version, input)
  if (!args.p_response || !args.p_office || !esOficioPublicableQueja(adjunto, queja.id) || adjunto.id !== args.p_file) {
    throw new Error('Completá la respuesta, el número de oficio y el documento oficial de este expediente.')
  }
  if (adjunto.tipo_mime.toLowerCase() !== 'application/pdf' || !/\.pdf$/i.test(adjunto.nombre)) {
    throw new Error('El documento final enviado al cliente debe ser un PDF válido.')
  }
  if (input.noProcede) return callRpc<Queja>('qms_publish_rejected_response', { ...args, ...rechazoArgs(input, true) })
  if (input.correo) {
    validarCorreoQueja(input.correo, true)
    Object.assign(args, { p_email_subject: input.correo.asunto.trim(), p_email_body: input.correo.cuerpo.trim() })
  }
  return callRpc<Queja>(input.correo ? 'qms_publish_approved_response_v2' : 'qms_publish_approved_response', args)
}

export function actualizarRegistroQueja(input: RegistroQuejaInput) {
  const values = trimTextFields({ ...input })
  const revision = revisionEsperada({ id: input.quejaId, revision: input.revision })
  if (values.area.length > REGISTRO_QUEJA_LIMITES.area) throw new Error('El área afectada es demasiado larga.')
  if (values.numeroOficio.length > REGISTRO_QUEJA_LIMITES.oficio) throw new Error('El número de oficio es demasiado largo.')
  if (values.observaciones.length > REGISTRO_QUEJA_LIMITES.observaciones) throw new Error('Las observaciones son demasiado largas.')
  return callRpc<Queja>('qms_update_complaint_register', {
    p_id: values.quejaId,
    p_expected: revision,
    p_area: values.area || null,
    p_office_number: values.numeroOficio || null,
    p_observations: values.observaciones || null,
  })
}

/** El catálogo persiste una vez; el registro sigue guardándose con su revisión. */
export function guardarAreaQueja(area: string): Promise<{ valor: string }> {
  const value = area.trim()
  requireText(value, 'Área afectada')
  if (value.length > REGISTRO_QUEJA_LIMITES.area) throw new Error('El área afectada es demasiado larga.')
  return callRpc('qms_save_complaint_area', { p_value: value })
}

export async function derivarQuejaASACP(quejaId: string): Promise<{ accion: SACP; queja: Queja | null }> {
  const accion = await callRpc<SACP>('derivar_queja_a_sacp', { p_queja_id: quejaId })
  // La RPC incrementa la revisión del expediente al vincular la SACP: entregar
  // la revisión efectiva permite aprobar después sin reutilizar el snapshot anterior.
  const { data, error } = await supabase.from('qms_quejas').select('*').eq('id', quejaId).maybeSingle()
  return { accion, queja: error ? null : (data as Queja | null) }
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

export function reabrirQueja(queja: ExpedienteVersionado, motivo: string) {
  return transicionarQueja(queja, 'En Investigación', { motivoReapertura: motivo })
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
    throw new Error(detalle || `No se pudo subir el archivo a Google Drive (HTTP ${res.status})`)
  }
  const { adjunto } = (await res.json()) as { adjunto?: QuejaAdjunto }
  if (!adjunto?.id || adjunto.queja_id !== quejaId || !adjunto.storage_path) throw new Error('El servidor no confirmó el adjunto')
  return adjunto
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
    throw new Error(detalle || `No se pudo eliminar el adjunto (HTTP ${res.status})`)
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

  const blob = await fetchDriveBlob(adjunto.storage_path)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = adjunto.nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
