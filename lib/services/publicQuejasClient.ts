import { validarTamanoAdjunto } from '@/lib/constants/adjuntos'
export { CATEGORIAS_PUBLICAS, MAX_PUBLIC_FILES, PUBLIC_FILE_ACCEPT, MAX_FILE_BYTES } from '@/lib/constants/publicForms'
import { getUserError } from '@/lib/errors/userError'
import { validarEnlaceSeguimientoPrivado } from '@/lib/utils/publicTrackingLink'
import { PublicQuejaValidationError, publicQuejaFieldFromCode, validatePublicQuejaDraft, type PublicQuejaDraft, type PublicQuejaField } from '@/lib/utils/publicQuejaValidation'
export type { PublicQuejaDraft, PublicQuejaField } from '@/lib/utils/publicQuejaValidation'

export interface FormularioPublico {
  nombre: string
  modulo: 'quejas'
  uploadsAllowed: boolean
}

export interface PublicQuejaInput extends PublicQuejaDraft {
  formToken: string
  submissionId: string
  honeypot: string
}

export interface PublicQuejaReceipt {
  folio: string
  quejaId: string
  uploadToken: string
  submissionId: string
  expiresAt: string
}

export type PublicTrackingState = 'disabled' | 'available' | 'pending'
export interface PublicQuejaFinalization { trackingUrl: string | null; trackingState: PublicTrackingState }

export class PublicRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string, public readonly serverMessage?: string) {
    super('No se pudo completar la solicitud pública')
  }
}

export function publicErrorMessage(error: unknown, fallback: string): string {
  const field = fieldFromPublicError(error)
  if (field) return new PublicQuejaValidationError(field).message
  if (error instanceof PublicRequestError) {
    if (error.status === 503) return 'El servicio no está disponible en este momento. Intentá más tarde.'
    if (error.status === 429) return 'Se alcanzó el límite temporal de solicitudes. Esperá un momento antes de reintentar.'
    if (error.status === 403) {
      if (error.code === 'honeypot_rejected') return 'El autocompletado agregó un dato fuera del formulario. Tus datos se conservaron; probá enviar de nuevo.'
      if (error.code === 'verification_failed') return 'No se pudo confirmar que sos una persona. Probá enviar de nuevo; si persiste, contactá al administrador.'
      return 'No se pudo verificar el envío. Volvé a intentarlo.'
    }
    if (error.status === 410) return 'El plazo para adjuntar evidencias venció. Conservá tu folio para dar seguimiento.'
    if (error.status === 409) return 'El intento anterior todavía no puede confirmarse. Esperá un momento y reintentá el mismo envío.'
    if (error.status === 400 || error.status === 422) return 'Revisá los datos del formulario antes de enviarlo.'
    if (error.status === 413) return 'El archivo supera el límite de 4 MB.'
    if (error.status === 415) return 'Solo se permiten archivos PDF, JPEG y PNG.'
    if (error.serverMessage) return getUserError({ message: error.serverMessage }, fallback).message
    return fallback
  }
  return getUserError(error, fallback).message
}

export function fieldFromPublicError(error: unknown): PublicQuejaField | null {
  if (error instanceof PublicQuejaValidationError) return error.field
  if (error instanceof PublicRequestError && [400, 422].includes(error.status)) return publicQuejaFieldFromCode(error.code)
  return null
}

/** Un 400/422 genérico también puede llegar después de crear el registro. Solo los
 * códigos de campo cerrados certifican la validación previa del formulario. */
export function publicSubmissionMessage(error: unknown, fallback: string): string {
  if (error instanceof PublicRequestError && [400, 422].includes(error.status) && !fieldFromPublicError(error)) return fallback
  return publicErrorMessage(error, fallback)
}

/** La finalización opera sobre un envío ya reclamado: un rechazo 400/422 no puede culpar
 * los datos del ciudadano, porque fueron validados al reclamar el folio. */
export function publicFinalizationMessage(error: unknown, fallback: string): string {
  if (error instanceof PublicRequestError && (error.status === 400 || error.status === 422)) return fallback
  return publicErrorMessage(error, fallback)
}

async function publicJson(url: string, options: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...options, cache: 'no-store' })
  if (!response.ok) {
    let code: string | undefined
    let serverMessage: string | undefined
    try {
      const body = await response.json()
      code = typeof body.code === 'string' ? body.code : undefined
      serverMessage = typeof body.error === 'string' ? body.error : undefined
    } catch {}
    throw new PublicRequestError(response.status, code, serverMessage)
  }
  const result: unknown = await response.json().catch(() => { throw new Error('Respuesta no válida del servicio') })
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Respuesta no válida del servicio')
  return result as Record<string, unknown>
}

export async function fetchFormularioPublico(token: string, signal?: AbortSignal): Promise<FormularioPublico> {
  const data = await publicJson(`/api/public/formularios/${encodeURIComponent(token)}`, { signal })
  if (typeof data.nombre !== 'string' || data.modulo !== 'quejas' || typeof data.uploadsAllowed !== 'boolean') {
    throw new Error('Respuesta no válida del servicio')
  }
  return { nombre: data.nombre, modulo: data.modulo, uploadsAllowed: data.uploadsAllowed }
}

export async function crearQuejaPublica(input: PublicQuejaInput, signal?: AbortSignal): Promise<PublicQuejaReceipt> {
  const data = await publicJson('/api/public/quejas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  })
  if (['folio', 'quejaId', 'uploadToken', 'submissionId', 'expiresAt'].some((key) => typeof data[key] !== 'string' || !data[key])
    || data.submissionId !== input.submissionId || !Number.isFinite(Date.parse(data.expiresAt as string))) {
    throw new Error('No se recibió la confirmación del registro. Reintentá el mismo envío.')
  }
  return data as unknown as PublicQuejaReceipt
}

export async function subirAdjuntoPublico(file: File, uploadToken: string, uploadId: string, signal?: AbortSignal): Promise<void> {
  validarArchivoPublico(file)
  const body = new FormData()
  body.append('file', file)
  body.append('uploadToken', uploadToken)
  body.append('uploadId', uploadId)
  const data = await publicJson('/api/drive/upload-public', { method: 'POST', body, signal })
  if (typeof data.drive_file_id !== 'string' || !data.drive_file_id || typeof data.queja_id !== 'string' || !data.queja_id) {
    throw new Error('No se recibió la confirmación del archivo. Reintentá la evidencia.')
  }
}

export async function finalizarQuejaPublica(uploadToken: string, signal?: AbortSignal): Promise<PublicQuejaFinalization> {
  const result = await publicJson('/api/public/quejas/finalizar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadToken }), signal,
  })
  const trackingUrl = result.trackingUrl == null ? null : validarEnlaceSeguimientoPrivado(result.trackingUrl)
  // El emisor anterior no devolvía estado: conservar esa compatibilidad sin inventar un enlace.
  const trackingState = result.trackingState ?? (trackingUrl ? 'available' : 'disabled')
  if (!['disabled', 'available', 'pending'].includes(String(trackingState))
    || (trackingState === 'available') !== !!trackingUrl) throw new Error('No se pudo confirmar el enlace de seguimiento.')
  return { trackingUrl, trackingState: trackingState as PublicTrackingState }
}

export function validarArchivoPublico(file: Pick<File, 'name' | 'type' | 'size'>): void {
  validarTamanoAdjunto(file)
  const extension = file.name.split('.').pop()?.toLowerCase()
  const formats: Record<string, readonly string[]> = {
    'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'],
  }
  if (!formats[file.type]?.includes(extension ?? '')) throw new Error('Solo se permiten archivos PDF, JPEG y PNG con su extensión correspondiente')
}

export function validarBorradorPublico(draft: PublicQuejaDraft): PublicQuejaDraft {
  return validatePublicQuejaDraft(draft)
}

