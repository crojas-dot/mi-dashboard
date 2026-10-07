'use client'

import { useEffect, useId, useRef, type MouseEvent } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dialog' | 'drawer'
  children: React.ReactNode
}

const sizes: Record<string, string> = {
  sm: 'max-w-[500px]',
  md: 'max-w-[600px]',
  lg: 'max-w-[700px]',
}
let scrollLocks = 0
let previousOverflow = ''

export default function Modal({ open, onClose, title, size = 'md', variant = 'dialog', children }: ModalProps) {
  const drawer = variant === 'drawer'
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropDown = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    if (scrollLocks++ === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    return () => {
      dialog.close()
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow
      if (document.activeElement === document.body && origin?.isConnected) origin.focus()
    }
  }, [open])

  if (!open) return null

  const outside = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return false
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      className={`fixed flex-col overflow-hidden border-0 p-0 shadow-lg backdrop:bg-black/50 open:flex ${drawer ? 'inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100%-2rem))] max-w-none bg-qms-dark text-white' : `inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] rounded-modal bg-qms-surface text-qms-dark ${sizes[size]}`}`}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
          .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls.at(-1)
        if (!first) { event.preventDefault(); return }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}
      onMouseDown={(event) => { backdropDown.current = outside(event) }}
      onClick={(event) => {
        if (backdropDown.current && outside(event)) onClose()
        backdropDown.current = false
      }}
    >
        {drawer ? <h2 id={titleId} className="sr-only">{title}</h2> : <div
          data-modal-header
          className="flex shrink-0 items-center justify-between rounded-t-modal bg-qms-dark px-4 py-3 text-white"
        >
          <h2 id={titleId} className="m-0 text-base font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Cerrar ${title}`}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-button border border-transparent bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>}
        <div className={drawer ? 'flex min-h-0 flex-1 overflow-hidden' : 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-qms-hover-bg px-4 py-4'}>{children}</div>
    </dialog>
  )
}
