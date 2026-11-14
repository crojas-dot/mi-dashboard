import { apiFetch } from '@/lib/services/apiClient'
import { useAuthStore } from '@/lib/store/auth-store'

const PREVIEW_CACHE_MS = 45_000
const MAX_PREVIEWS = 5
type CachedFile = { owner: string; expires: number; promise: Promise<Blob> }
const previews = new Map<string, CachedFile>()

// Ningún archivo sigue disponible en la caché después de cambiar de identidad
// o iniciar logout. La autorización real permanece en /api/drive/download.
useAuthStore.subscribe?.((next, previous) => {
  if (next.signingOut || next.user?.id !== previous.user?.id || next.user?.rol !== previous.user?.rol) previews.clear()
})

function currentActor(): string {
  const session = useAuthStore.getState()
  if (!session.user?.id || session.signingOut) throw new DOMException('La sesión cambió', 'AbortError')
  return session.user.id + ':' + session.user.rol
}

function sameActor(actor: string, signal?: AbortSignal): void {
  signal?.throwIfAborted()
  if (currentActor() !== actor) throw new DOMException('La sesión cambió', 'AbortError')
}

function awaitVisit<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const aborted = () => {
      signal.removeEventListener('abort', aborted)
      reject(new DOMException('La vista fue cerrada', 'AbortError'))
    }
    signal.addEventListener('abort', aborted, { once: true })
    pending.then(value => { signal.removeEventListener('abort', aborted); resolve(value) },
      error => { signal.removeEventListener('abort', aborted); reject(error) })
  })
}

/** Reutiliza brevemente bytes ya autorizados para evitar repetir la cadena de
 * comprobaciones de Drive al volver a abrir el visor del mismo expediente.
 * El caché es privado a la identidad QMS y no persiste fuera de memoria. */
export async function fetchDriveBlob(fileId: string, signal?: AbortSignal): Promise<Blob> {
  const actor = currentActor()
  sameActor(actor, signal)
  const key = actor + ':' + fileId
  const cached = previews.get(key)
  if (cached && cached.expires > Date.now()) {
    const blob = await awaitVisit(cached.promise, signal)
    sameActor(actor, signal)
    return blob
  }
  previews.delete(key)
  const request = (async () => {
    const response = await apiFetch(`/api/drive/download?id=${encodeURIComponent(fileId)}`, { signal, cache: 'no-store' })
    sameActor(actor, signal)
    if (!response.ok) throw Object.assign(new Error('No se pudo acceder al archivo'), { status: response.status })
    const blob = await response.blob()
    sameActor(actor, signal)
    return blob
  })()
  const entry = { owner: actor, expires: Date.now() + PREVIEW_CACHE_MS, promise: request }
  previews.set(key, entry)
  while (previews.size > MAX_PREVIEWS) previews.delete(previews.keys().next().value!)
  try { return await awaitVisit(request, signal) }
  catch (error) { if (previews.get(key) === entry) previews.delete(key); throw error }
}

/** Inicio anticipado con la sesión interna, sin popups ni autenticación Google.
 * Se limita al número de evidencias más probable de consultar. */
export function prefetchDriveBlob(fileId: string): void {
  if (!fileId || fileId.includes('/')) return
  try { void fetchDriveBlob(fileId).catch(() => {}) } catch { /* sesión no disponible */ }
}
