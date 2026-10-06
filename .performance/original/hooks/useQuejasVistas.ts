'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const EVENT = 'eca-quejas-vistas'
const MAX_ENTRIES = 500
const EMPTY = '[]'

function leer(key: string): string {
  if (!key) return EMPTY
  try { return localStorage.getItem(key) ?? EMPTY } catch { return EMPTY }
}
function parsear(raw: string): Set<string> {
  try {
    const value: unknown = JSON.parse(raw)
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(-MAX_ENTRIES) : [])
  } catch { return new Set() }
}
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener(EVENT, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(EVENT, listener)
  }
}
export function useQuejasVistas(userId: string | undefined) {
  const key = userId ? 'eca_quejas_vistas_' + userId : ''
  const getSnapshot = useCallback(() => leer(key), [key])
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
  const vistas = useMemo(() => parsear(raw), [raw])
  const marcarTodasVistas = useCallback((ids: string[]) => {
    if (!key) return
    const next = parsear(leer(key))
    for (const id of ids) next.add(id)
    try {
      localStorage.setItem(key, JSON.stringify([...next].slice(-MAX_ENTRIES)))
      window.dispatchEvent(new Event(EVENT))
    } catch { /* El navegador puede tener el almacenamiento deshabilitado. */ }
  }, [key])
  const marcarVista = useCallback((id: string) => marcarTodasVistas([id]), [marcarTodasVistas])
  const esVista = useCallback((id: string) => vistas.has(id), [vistas])
  const contarNoVistas = useCallback((ids: string[]) => ids.filter((id) => !vistas.has(id)).length, [vistas])
  return { esVista, marcarVista, marcarTodasVistas, contarNoVistas }
}
