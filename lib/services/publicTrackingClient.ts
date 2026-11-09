import { publicTrackingStatus, type PublicTrackingStatus } from '@/lib/types/publicTracking'
import { validarEnlaceSeguimientoPrivado } from '@/lib/utils/publicTrackingLink'

async function trackingResponse(url: string, body: object, signal?: AbortSignal) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal })
  if (!response.ok) throw new Error(response.status === 429 ? 'Esperá un momento antes de consultar de nuevo.'
    : response.status === 503 ? 'El seguimiento no está disponible en este momento. Conservá tu enlace e intentá más tarde.'
      : 'No se pudo consultar el trámite. El enlace puede ser inválido o haber vencido. Contactá a Gestión de Calidad si necesitás ayuda.')
  return response
}

export async function consultarSeguimiento(clave: string, folio?: string, signal?: AbortSignal): Promise<PublicTrackingStatus> {
  const response = await trackingResponse('/api/public/seguimiento', { clave, ...(folio ? { folio } : {}) }, signal)
  return publicTrackingStatus(await response.json())
}

export async function descargarResolucionPublica(clave: string, documentoId: string, folio: string, signal?: AbortSignal): Promise<Blob> {
  const response = await trackingResponse('/api/public/seguimiento/documento', { clave, documentoId, folio }, signal)
  const blob = await response.blob()
  if (blob.size > 4 * 1024 * 1024) throw new Error('No se pudo descargar el documento.')
  return blob
}

export function claveDesdeEnlace(value: string): string {
  try {
    const candidate = validarEnlaceSeguimientoPrivado(value.trim())
    return new URLSearchParams(new URL(candidate).hash.slice(1)).get('clave') ?? ''
  } catch { return '' }
}
