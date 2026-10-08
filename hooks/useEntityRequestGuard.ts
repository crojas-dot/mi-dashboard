'use client'

import { useLayoutEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { captureQueryContext } from '@/lib/queries/queryContextScope'
import { createRequestScope, type RequestScope } from '@/lib/utils/requestScope'

export type EntityRequestScope = RequestScope & { captureContext: () => () => boolean }

export function useEntityRequestGuard(entityId: string | null): EntityRequestScope {
  const queryClient = useQueryClient()
  // QueryProvider remonta sus hijos al cambiar identidad/rol/vista, y conserva cliente al navegar.
  const [scope] = useState(() => ({ ...createRequestScope(), captureContext: () => captureQueryContext(queryClient) }))
  useLayoutEffect(() => {
    if (entityId) scope.activate()
    return () => scope.invalidate()
  }, [entityId, scope])
  return scope
}
