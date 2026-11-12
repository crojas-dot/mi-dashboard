'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Toaster } from 'sonner'

export default function ToastProvider() {
  const [activeDialog, setActiveDialog] = useState<HTMLDialogElement | null>(null)

  useEffect(() => {
    // Los diálogos nativos abiertos con showModal viven en la top layer del
    // navegador: un z-index alto fuera del diálogo no hace visibles los avisos.
    const findTopDialog = () => {
      const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog:modal')]
      setActiveDialog(current => {
        if (current && current.isConnected && current.matches(':modal')) {
          // Un modal nuevo puede abrirse sobre uno anterior (confirmaciones/visores).
          const last = dialogs.at(-1) ?? null
          return last === current ? current : last
        }
        return dialogs.at(-1) ?? null
      })
    }
    findTopDialog()
    const observer = new MutationObserver(findTopDialog)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    return () => observer.disconnect()
  }, [])

  const toaster = (
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

  return activeDialog ? createPortal(toaster, activeDialog) : toaster
}
