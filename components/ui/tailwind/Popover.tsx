'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import Button from './Button'
import { cn } from './cn'

interface PopoverProps {
  open: boolean
  onToggle: () => void
  onClose: () => void
  label: string
  trigger: ReactNode
  children: ReactNode
  triggerClassName?: string
  panelClassName?: string
}

export default function Popover({ open, onToggle, onClose, label, trigger, children, triggerClassName, panelClassName }: PopoverProps) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  const focusedInPanel = useRef(false)
  useEffect(() => { close.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const content = panel.current
    const triggerButton = button.current
    const first = content?.querySelector<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')
    ;(first ?? content)?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close.current()
    }
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      if (content?.contains(document.activeElement) || (document.activeElement === document.body && focusedInPanel.current)) triggerButton?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || !focusedInPanel.current || document.activeElement !== document.body) return
    const content = panel.current
    const first = content?.querySelector<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')
    ;(first ?? content)?.focus()
  })

  return <div ref={root} className="tw:relative" onFocusCapture={(event) => {
    focusedInPanel.current = panel.current?.contains(event.target) ?? false
  }} onBlur={(event) => {
    if (open && !event.currentTarget.contains(event.relatedTarget)) {
      focusedInPanel.current = false
      onClose()
    }
  }} onKeyDown={(event) => {
    if (!open || event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    event.stopPropagation()
    onClose()
    button.current?.focus()
  }}>
    <Button ref={button} variant="ghost" size="sm" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={onToggle} className={triggerClassName}>
      {trigger}
    </Button>
    {open && <div ref={panel} id={id} role="dialog" aria-label={label} tabIndex={-1} className={cn(
      'tw:absolute tw:right-0 tw:top-full tw:z-50 tw:mt-2 tw:max-h-[calc(100dvh-5rem)] tw:overflow-y-auto tw:overscroll-contain tw:rounded-xl tw:border tw:border-border tw:bg-surface tw:p-3 tw:font-sans tw:text-foreground tw:shadow-xl tw:focus:outline-none tw:focus:ring-2 tw:focus:ring-primary/30 tw:max-[640px]:fixed tw:max-[640px]:left-4 tw:max-[640px]:right-4 tw:max-[640px]:top-16 tw:max-[640px]:mt-0 tw:max-[640px]:w-auto',
      panelClassName,
    )}>{children}</div>}
  </div>
}