'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { showError } from '@/lib/services/errorToast'

export default function RegistroDesdeEnlace<T>({ clave, cargar, abrir, habilitado = true }: {
  clave: readonly unknown[]
  cargar: (id: string, signal: AbortSignal) => Promise<T | null>
  abrir: (registro: T) => void
  habilitado?: boolean
}) {
  const param = useSearchParams().get('abrir')
  const id = param && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(param) ? param : null
  const query = useQuery({
    queryKey: [...clave, 'desde-enlace', id],
    queryFn: ({ signal }) => id ? cargar(id, signal) : null,
    enabled: habilitado && !!id,
    retry: false,
  })
  const consumido = useRef<string | null>(null)
  useEffect(() => {
    if (!param) { consumido.current = null; return }
    if (!habilitado || consumido.current === param || id && (query.isFetching || !query.isSuccess && !query.isError)) return
    // Ignorar una respuesta tardía si se navegó a otra URL durante la lectura.
    const url = new URL(window.location.href)
    if (url.searchParams.get('abrir') !== param) return
    consumido.current = param
    url.searchParams.delete('abrir')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    if (query.isSuccess && query.data) abrir(query.data)
    else showError(null, 'No se pudo abrir el registro. Puede que ya no esté disponible para tu cuenta.')
  }, [param, id, habilitado, abrir, query.isSuccess, query.isError, query.isFetching, query.data])
  return null
}
