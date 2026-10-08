'use client'

import RouteErrorFallback, { type RouteErrorProps } from '@/components/RouteErrorFallback'

export default function QuejasError(props: RouteErrorProps) {
  return <RouteErrorFallback {...props} source="quejas" title="Error en Quejas" message="No se pudieron cargar las quejas. Por favor intentá de nuevo." />
}
