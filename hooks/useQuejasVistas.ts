'use client'

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY_PREFIX = 'eca_quejas_vistas_'
const MAX_ENTRIES = 500 // Limitar tamaño del localStorage

/**
 * Hook que trackea qué quejas ha abierto/visto el usuario actual.
 * Usa localStorage por usuario para persistir entre sesiones.
 * Cuando el usuario abre el detalle de una queja, se marca como "vista".
 * Las no vistas se resaltan visualmente en la tabla (estilo Gmail).
 */
export function useQuejasVistas(userId: string | undefined) {
  const storageKey = userId ? `${STORAGE_KEY_PREFIX}${userId}` : ''

  const [vistas, setVistas] = useState<Set<string>>(() => {
    if (!storageKey) return new Set()
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const arr: string[] = JSON.parse(raw)
        return new Set(arr)
      }
    } catch {
      // localStorage corrupto o no disponible
    }
    return new Set()
  })

  // Re-sync si cambia el userId
  useEffect(() => {
    if (!storageKey) {
      setVistas(new Set())
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const arr: string[] = JSON.parse(raw)
        setVistas(new Set(arr))
      } else {
        setVistas(new Set())
      }
    } catch {
      setVistas(new Set())
    }
  }, [storageKey])

  const persistir = useCallback((nuevoSet: Set<string>) => {
    if (!storageKey) return
    try {
      // Limitar a MAX_ENTRIES más recientes (los últimos insertados)
      const arr = Array.from(nuevoSet)
      const trimmed = arr.length > MAX_ENTRIES ? arr.slice(-MAX_ENTRIES) : arr
      localStorage.setItem(storageKey, JSON.stringify(trimmed))
    } catch {
      // Espacio lleno — limpiar y reintentar
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // sin remedio
      }
    }
  }, [storageKey])

  /** Marcar una queja como vista */
  const marcarVista = useCallback((quejaId: string) => {
    setVistas((prev) => {
      if (prev.has(quejaId)) return prev
      const next = new Set(prev)
      next.add(quejaId)
      persistir(next)
      return next
    })
  }, [persistir])

  /** Verificar si una queja ya fue vista */
  const esVista = useCallback((quejaId: string) => vistas.has(quejaId), [vistas])

  /** Marcar todas las quejas visibles como vistas */
  const marcarTodasVistas = useCallback((quejaIds: string[]) => {
    setVistas((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of quejaIds) {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      }
      if (!changed) return prev
      persistir(next)
      return next
    })
  }, [persistir])

  /** Cantidad de no vistas en un array de IDs */
  const contarNoVistas = useCallback((quejaIds: string[]) => {
    return quejaIds.filter((id) => !vistas.has(id)).length
  }, [vistas])

  return { esVista, marcarVista, marcarTodasVistas, contarNoVistas }
}
