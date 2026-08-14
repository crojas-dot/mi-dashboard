'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps { open: boolean; onClose: () => void; title: string; size?: 'sm' | 'md' | 'lg'; children: React.ReactNode }
const sizes = { sm: 'max-w-lg', md: 'max-w-2xl', lg: 'max-w-4xl' }

export default function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) { document.addEventListener('keydown', handleEsc); document.body.style.overflow = 'hidden'; requestAnimationFrame(() => closeRef.current?.focus()) }
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return <div ref={overlayRef} className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === overlayRef.current && onClose()}><div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl sm:rounded-2xl ${sizes[size]}`}><div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4"><h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2><button ref={closeRef} type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Cerrar modal"><X className="size-4" /></button></div><div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div></div></div>
}
