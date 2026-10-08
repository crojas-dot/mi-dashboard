'use client'

import RouteErrorFallback, { type RouteErrorProps } from '@/components/RouteErrorFallback'

export default function GlobalRouteError(props: RouteErrorProps) {
  return <RouteErrorFallback {...props} source="route" title="Algo salió mal" message="Ocurrió un error inesperado. Por favor intentá de nuevo." />
}
