'use client'

import { Inter } from 'next/font/google'
import RouteErrorFallback, { type RouteErrorProps } from '@/components/RouteErrorFallback'
import '@/app/globals.css'

const inter = Inter({ subsets: ['latin'] })

export default function GlobalError(props: RouteErrorProps) {
  // Next sustituye el layout raíz: este fallback necesita documento, fuente y CSS propios.
  return (
    <html lang="es">
      <body className={inter.className + ' select-none'}>
        <main className="flex min-h-dvh items-center justify-center bg-qms-background dark:bg-gray-900">
          <title>Error inesperado | ECA-QMS</title>
          <RouteErrorFallback {...props} source="global" title="Error inesperado" message="Algo salió mal. Por favor intentá de nuevo." />
        </main>
      </body>
    </html>
  )
}
