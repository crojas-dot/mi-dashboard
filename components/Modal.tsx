'use client'

import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const sizes: Record<string, string> = {
  sm: 'max-w-[500px]',
  md: 'max-w-[600px]',
  lg: 'max-w-[700px]',
}

export default function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    if (open) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/50"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={`flex w-full ${sizes[size]} max-h-[90vh] flex-col rounded-modal bg-qms-surface`}>
        <div
          className="flex shrink-0 items-center justify-between rounded-t-modal bg-qms-dark px-4 py-3 text-white"
        >
          <h5 className="m-0 text-sm font-semibold">{title}</h5>
          <button
            type="button"
            onClick={onClose}
            className="flex cursor-pointer items-center justify-center rounded-button border-0 bg-transparent p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-b-modal bg-qms-hover-bg px-4 py-3">{children}</div>
      </div>
    </div>
  )
}
