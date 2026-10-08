'use client'

import { useEffect } from 'react'
import ErrorState from '@/components/ui/ErrorState'
import { getUserError } from '@/lib/errors/userError'

export interface RouteErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

interface RouteErrorFallbackProps extends RouteErrorProps {
  title: string
  message: string
  source: 'route' | 'global' | 'documentos' | 'quejas'
}

export default function RouteErrorFallback({ error, reset, title, message, source }: RouteErrorFallbackProps) {
  useEffect(() => {
    // Un error de render también puede contener datos privados; registrar solo su código seguro.
    console.error('[' + source + '-error]', getUserError(error).code ?? 'APP_ERROR')
  }, [error, source])

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
      <ErrorState title={title} message={message} onRetry={reset} retryLabel="Intentar de nuevo" className="w-full max-w-md" />
    </div>
  )
}
