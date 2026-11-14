import { apiFetch } from '@/lib/services/apiClient'
import { useAuthStore } from '@/lib/store/auth-store'

const PREVIEW_CACHE_MS = 45_000
const MAX_PREVIEWS = 5

type CachedFile = {
  owner: string
  expires: number
  promise: Promise<Blob>
  controller: AbortController
}

const previews = new Map<string, CachedFile>()

// Ninguna visita puede conservar una evidencia tras logout, cambio de identidad o rol.
useAuthStore.subscribe?.((next, previous) => {
  if (next.signingOut || next.user?.id !== previous.user?.id || next.user?.rol !== previous.user?.rol) {
    for (const entry of previews.values()) entry.controller.abort()
    previews.clear()
  }
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

/** Reutiliza una única petición protegida entre vistas, sin que cerrar un modal
 * cancele la precarga de los demás. La API valida token, rol y ruta Drive. */
export async function fetchDriveBlob(fileId: string, signal?: AbortSignal): Promise<Blob> {
  const actor = currentActor()
  sameActor(actor, signal)
  const key = actor + ':' + fileId
  let entry = previews.get(key)

  if (!entry || entry.expires <= Date.now() || entry.controller.signal.aborted) {
    if (entry) entry.controller.abort()
    const controller = new AbortController()
    const promise = (async () => {
      const response = await apiFetch(`/api/drive/download?id=${encodeURIComponent(fileId)}`, {
        signal: controller.signal, cache: 'no-store',
      })
      sameActor(actor, controller.signal)
      if (!response.ok) throw Object.assign(new Error('No se pudo acceder al archivo'), { status: response.status })
      const blob = await response.blob()
      sameActor(actor, controller.signal)
      return blob
    })()

    entry = { owner: actor, expires: Date.now() + PREVIEW_CACHE_MS, promise, controller }
    const created = entry
    previews.set(key, entry)
    void promise.catch(() => { if (previews.get(key) === created) previews.delete(key) })
    while (previews.size > MAX_PREVIEWS) {
      const oldest = previews.keys().next().value!
      previews.get(oldest)?.controller.abort()
      previews.delete(oldest)
    }
  }
  const blob = await awaitVisit(entry.promise, signal)
  sameActor(actor, signal)
  return blob
}

/** Precarga por intención o por documento elegido, únicamente con la sesión QMS. */
export function prefetchDriveBlob(fileId: string): void {
  if (!fileId || fileId.includes('/')) return
  try { void fetchDriveBlob(fileId).catch(() => {}) } catch { /* sesión no disponible */ }
}
