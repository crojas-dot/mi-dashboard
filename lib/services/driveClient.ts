import { apiFetch } from '@/lib/services/apiClient'
import { useAuthStore } from '@/lib/store/auth-store'

/** Drive privado se lee con la sesión QMS; el ID por sí solo no autoriza acceso. */
export async function fetchDriveBlob(fileId: string, signal?: AbortSignal): Promise<Blob> {
  const userId = useAuthStore.getState().user?.id
  const assertCurrent = () => {
    signal?.throwIfAborted()
    const current = useAuthStore.getState()
    if (!userId || current.user?.id !== userId || current.signingOut) throw new DOMException('La sesión cambió', 'AbortError')
  }
  assertCurrent()
  const response = await apiFetch(`/api/drive/download?id=${encodeURIComponent(fileId)}`, { signal, cache: 'no-store' })
  assertCurrent()
  if (!response.ok) throw Object.assign(new Error('No se pudo acceder al archivo'), { status: response.status })
  const blob = await response.blob()
  assertCurrent()
  return blob
}
