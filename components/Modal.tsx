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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={`flex w-full ${sizes[size]} max-h-[90vh] flex-col bg-white shadow-xl`} style={{ borderRadius: '12px', border: 'none' }}>
        <div
          className="flex shrink-0 items-center justify-between rounded-t-xl px-4 py-3 text-white"
          style={{ backgroundColor: '#212529', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}
        >
          <h5 className="m-0 font-semibold" style={{ fontSize: '14px' }}>{title}</h5>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', background: 'transparent', padding: '4px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 rounded-b-xl" style={{ backgroundColor: '#f8f9fa' }}>{children}</div>
      </div>
    </div>
  )
}
