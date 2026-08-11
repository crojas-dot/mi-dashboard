'use client'

import { Toaster } from 'sonner'

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          success: '!bg-blue-50 !border-l-4 !border-l-blue-600',
          error: '!bg-red-50 !border-l-4 !border-l-red-600',
          info: '!bg-blue-50 !border-l-4 !border-l-blue-600',
        },
      }}
    />
  )
}
