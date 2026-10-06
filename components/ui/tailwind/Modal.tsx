'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Button from './Button'
import { cn } from './cn'

interface ModalProps {
  open: boolean; onClose: () => void; title: string; size?: 'sm' | 'md' | 'lg' | 'xl'; children: ReactNode
  width?: number; hideHeader?: boolean; contentClassName?: string; bodyClassName?: string; headerActions?: ReactNode
}
const widths = { sm: 'tw:max-w-[360px]', md: 'tw:max-w-[560px]', lg: 'tw:max-w-[880px]', xl: 'tw:max-w-[1200px]' }

export default function Modal({ open, onClose, title, size = 'md', children, width, hideHeader, contentClassName, bodyClassName, headerActions }: ModalProps) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const backdropDown = useRef(false)
  useEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    return () => {
      element.close()
      if (document.activeElement === document.body && origin?.isConnected) origin.focus()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null
  const outside = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return false
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }
  return createPortal(<dialog ref={dialog} role="dialog" aria-labelledby={id} aria-modal="true" onCancel={(event) => {
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }} onMouseDown={(event) => { backdropDown.current = outside(event) }} onClick={(event) => {
    if (backdropDown.current && outside(event)) onClose()
    backdropDown.current = false
  }} onKeyDown={(event) => {
    if (event.key !== 'Tab') return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(node => node.getClientRects().length > 0)
    const first = items[0], last = items.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }} style={width ? { maxWidth: width } : undefined} className={cn('tw:fixed tw:inset-0 tw:m-auto tw:max-h-[calc(100dvh-2rem)] tw:w-[calc(100vw-2rem)] tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-border tw:bg-surface tw:p-0 tw:font-sans tw:text-foreground tw:shadow-2xl tw:backdrop:bg-black/60 tw:backdrop:blur-sm tw:open:flex', !width && widths[size], contentClassName)}>
    {hideHeader ? <><h2 id={id} className="tw:sr-only">{title}</h2><Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar" className="tw:absolute tw:right-3 tw:top-3 tw:z-30 tw:size-10"><X className="tw:size-5" aria-hidden="true" /></Button></> : <div className="tw:flex tw:shrink-0 tw:items-center tw:justify-between tw:gap-4 tw:bg-gradient-to-r tw:from-primary/10 tw:to-primary/5 tw:border-b tw:border-border tw:px-6 tw:py-4">
      <h2 id={id} className="tw:m-0 tw:text-xl tw:font-semibold tw:leading-tight">{title}</h2>
      {headerActions && <div className="tw:ms-auto tw:flex tw:items-center tw:gap-2">{headerActions}</div>}
      <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar" className="tw:size-10 tw:p-0 tw:text-muted-foreground tw:hover:text-foreground"><X className="tw:size-5" aria-hidden="true" /></Button>
    </div>}
    <div className={cn('tw:min-h-0 tw:overflow-y-auto tw:overscroll-contain tw:p-6', bodyClassName)}>{children}</div>
  </dialog>, document.body)
}