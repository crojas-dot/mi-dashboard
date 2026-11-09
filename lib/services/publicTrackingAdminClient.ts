import { apiFetch } from '@/lib/services/apiClient'
import { validarEnlaceSeguimientoPrivado } from '@/lib/utils/publicTrackingLink'
export { validarEnlaceSeguimientoPrivado } from '@/lib/utils/publicTrackingLink'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Mutación explícita sin caché: nunca consulta un RPC público por consecutivo. */
export async function obtenerEnlaceSeguimientoPrivado(input: { formId: string; folio: string }, signal?: AbortSignal): Promise<string> {
  const folio = input.folio.trim()
  if (!uuid.test(input.formId) || !folio || folio.length > 120 || /[\u0000-\u001f\u007f]/.test(folio)) {
    throw new Error('Indicá un formulario y un consecutivo válidos.')
  }
  let response: Response
  try {
    response = await apiFetch('/api/quejas/seguimiento', {
      method: 'POST', body: JSON.stringify({ formId: input.formId, folio }), signal, cache: 'no-store',
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('No se pudo obtener el enlace privado. Intentá de nuevo.')
  }
  if (!response.ok) {
    const message = response.status === 404 ? 'No se encontró un envío finalizado de este formulario con ese consecutivo.'
      : response.status === 401 || response.status === 403 ? 'Tu sesión no permite obtener este enlace. Volvé a iniciar sesión.'
      : response.status === 503 ? 'El seguimiento privado está pendiente de activación.'
      : 'No se pudo obtener el enlace privado. Intentá de nuevo.'
    throw new Error(message)
  }
  const result: unknown = await response.json().catch(() => null)
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('No se recibió un enlace privado válido.')
  return validarEnlaceSeguimientoPrivado((result as { url?: unknown }).url)
}
