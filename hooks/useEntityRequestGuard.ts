'use client'

import { useLayoutEffect, useState } from 'react'
import { createRequestScope } from '@/lib/utils/requestScope'

export function useEntityRequestGuard(entityId: string | null) {
  const [scope] = useState(createRequestScope)
  // El cleanup invalida al cambiar entidad, cerrar o desmontar, antes del siguiente paint.
  useLayoutEffect(() => {
    if (entityId) scope.activate()
    return () => scope.invalidate()
  }, [entityId, scope])
  return scope
}
