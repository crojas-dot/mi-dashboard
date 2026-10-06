'use client'

import { Toaster } from 'sonner'

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      theme="light"
      className="font-sans!"
      containerAriaLabel="Avisos del sistema"
      closeButton
      duration={4000}
      toastOptions={{
        closeButtonAriaLabel: 'Cerrar aviso',
        classNames: {
          toast: 'bg-qms-surface! text-qms-dark! border-qms-border! border! rounded-card! shadow-md! text-sm! gap-3! pr-11!',
          title: 'font-medium! leading-relaxed!',
          description: 'text-qms-muted! leading-relaxed!',
          content: 'min-w-0',
          icon: 'text-qms-primary!',
          closeButton: 'left-auto! right-3! top-3! transform-none! size-6! rounded-button! border-0! bg-qms-surface! text-qms-muted! hover:bg-qms-primary-soft! hover:text-qms-primary!',
          actionButton: 'bg-qms-primary! text-white! rounded-button!',
          cancelButton: 'bg-qms-hover-bg! text-qms-dark! rounded-button!',
        },
      }}
    />
  )
}
