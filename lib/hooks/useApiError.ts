'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { logger, type LogContext } from '@/lib/utils/logger'
import { normalizeApiError } from '@/lib/errors/apiError'

export function useApiError() {
  const handleError = useCallback((error: unknown, context: LogContext = {}) => {
    const normalized = normalizeApiError(error)
    logger.error('Error de API', { ...context, status: normalized.status, code: normalized.details })
    toast.error(normalized.message)
    return normalized
  }, [])
  return { handleError }
}
