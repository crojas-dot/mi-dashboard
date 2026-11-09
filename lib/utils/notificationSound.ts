interface SoundNotification {
  id: string
  leida: boolean
}

interface SoundSnapshot {
  userId: string | null
  ready: boolean
  enabled: boolean
  notifications: readonly SoundNotification[]
}

/** La primera lectura y los cambios de preferencias consumen historia sin hacerla sonar. */
export function createNotificationSoundTracker() {
  let userId: string | null = null
  let seen: Set<string> | null = null
  let wasEnabled = false

  return {
    observe(snapshot: SoundSnapshot): string[] {
      if (snapshot.userId !== userId || !snapshot.userId) {
        userId = snapshot.userId
        seen = null
        wasEnabled = false
      }
      if (!snapshot.enabled) wasEnabled = false
      if (!snapshot.userId || !snapshot.ready) return []

      const previous = seen
      seen ??= new Set()
      const incoming = snapshot.notifications.filter((item) => !previous?.has(item.id) && !item.leida)
      for (const item of snapshot.notifications) seen.add(item.id)
      const audible = previous !== null && wasEnabled && snapshot.enabled
      wasEnabled = snapshot.enabled
      return audible ? incoming.map((item) => item.id) : []
    },
  }
}

const CLAIM_TTL = 24 * 60 * 60 * 1000
const MAX_CLAIMS = 128
const CLAIM_DATABASE = 'qms-notification-sound'
const CLAIM_STORE = 'claims'

/**
 * La transacción readwrite confirma el reclamo antes de emitir audio. localStorage
 * puede conservar una copia obsoleta entre renderers incluso bajo un Web Lock.
 */
export async function claimNotificationSound(userId: string, ids: readonly string[], isCurrent: () => boolean): Promise<boolean> {
  if (typeof indexedDB === 'undefined' || !ids.length || !isCurrent()) return false
  return new Promise((resolve) => {
    let settled = false
    let connection: IDBDatabase | undefined
    const finish = (claimed: boolean) => {
      if (settled) return
      settled = true
      connection?.close()
      resolve(claimed && isCurrent())
    }
    try {
      const request = indexedDB.open(CLAIM_DATABASE, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(CLAIM_STORE)
      request.onerror = request.onblocked = () => finish(false)
      request.onsuccess = () => {
        connection = request.result
        if (settled) { connection.close(); return }
        if (!isCurrent()) { finish(false); return }
        try {
          const transaction = connection.transaction(CLAIM_STORE, 'readwrite')
          const store = transaction.objectStore(CLAIM_STORE)
          let claimed = false
          transaction.oncomplete = () => finish(claimed)
          transaction.onerror = transaction.onabort = () => finish(false)
          const read = store.get(userId)
          read.onsuccess = () => {
            if (!isCurrent()) return
            const now = Date.now(), stored: unknown = read.result
            const claims: { id: string; at: number }[] = Array.isArray(stored)
              ? stored.filter((entry): entry is { id: string; at: number } => !!entry && typeof entry.id === 'string'
                && typeof entry.at === 'number' && Number.isFinite(entry.at) && entry.at <= now + 60_000 && now - entry.at < CLAIM_TTL)
              : []
            const claimedIds = new Set(claims.map((entry) => entry.id))
            // Cada lote cabe completo; el pequeño margen futuro tolera desfase entre relojes.
            const fresh = [...new Set(ids)].slice(-MAX_CLAIMS).filter((id) => !claimedIds.has(id))
            if (!fresh.length) return
            // La clave es el usuario; el valor contiene únicamente IDs y fechas, nunca mensajes.
            store.put([...claims, ...fresh.map((id) => ({ id, at: now }))].slice(-MAX_CLAIMS), userId)
            claimed = true
          }
        } catch { finish(false) }
      }
    } catch { finish(false) }
    // Sin almacenamiento atómico se omite audio automático; campana y preview siguen disponibles.
  })
}
