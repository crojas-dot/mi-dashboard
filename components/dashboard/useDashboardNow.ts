'use client'

import { useEffect, useState } from 'react'

/** Actualiza solo los rótulos de plazos. No consulta la base de datos. */
export function useDashboardNow() {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const actualizar = () => {
      if (document.visibilityState === 'visible') setAhora(Date.now())
    }
    const intervalo = window.setInterval(actualizar, 60000)
    document.addEventListener('visibilitychange', actualizar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', actualizar)
    }
  }, [])
  return ahora
}
