'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="es">
      <body className="select-none">
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-800 mb-2">
              Error inesperado
            </h1>
            <p className="text-gray-500 mb-6">
              Algo salió mal. Por favor intentá de nuevo.
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-[#0d6efd] text-white rounded-md hover:bg-[#0b5ed7] transition-colors"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
