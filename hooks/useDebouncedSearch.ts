'use client'

import { useEffect, useState } from 'react'

export function useDebouncedSearch(value: string) {
  const search = value.trim()
  const [settledSearch, setSettledSearch] = useState(search)

  useEffect(() => {
    if (search === settledSearch) return
    const timeout = setTimeout(() => setSettledSearch(search), 350)
    return () => clearTimeout(timeout)
  }, [search, settledSearch])

  // Cambiar la clave de inmediato cancela la lectura anterior. La nueva
  // permanece desactivada hasta que se estabilice el término.
  return { search, ready: search === settledSearch }
}
