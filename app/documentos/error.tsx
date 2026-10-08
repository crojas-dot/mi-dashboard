'use client'

import RouteErrorFallback, { type RouteErrorProps } from '@/components/RouteErrorFallback'

export default function DocumentosError(props: RouteErrorProps) {
  return <RouteErrorFallback {...props} source="documentos" title="Error en Documentos" message="No se pudieron cargar los documentos. Por favor intentá de nuevo." />
}
