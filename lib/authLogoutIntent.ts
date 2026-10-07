const key = 'qms:logout-pending'
let pending = false

/** Solo una marca de bloqueo por pestaña; nunca guarda identidades ni tokens. */
export function isLogoutPending(): boolean {
  if (pending) return true
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

export function markLogoutPending(): void {
  pending = true
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(key, 'true')
  } catch { /* Mantener el bloqueo en memoria si el navegador impide Storage. */ }
}

export function clearLogoutPending(): void {
  pending = false
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key)
  } catch { /* El bloqueo persistido, si existe, sigue cerrando el acceso. */ }
}
