'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';


interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
}

interface DropdownMenuContentProps {
  children: ReactNode
  className?: string
}

interface DropdownMenuItemProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
  destructive?: boolean
}

export function DropdownMenu({ trigger, children, align = 'right' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (contentRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEsc)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  return (
    <div className="relative inline-block">
      <div ref={triggerRef} onClick={() => setOpen(!open)}>{trigger}</div>
      {open && createPortal(
        <div
          ref={contentRef}
          className={`fixed z-50 min-w-[180px] rounded-md border border-border bg-white py-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'} monday-scroll`}
          style={{ maxHeight: '300px', overflow: 'auto' }}
          role="menu"
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  )
}

export function DropdownMenuContent({ children, className = '' }: DropdownMenuContentProps) {
  return <div className={className}>{children}</div>
}

export function DropdownMenuItem({ children, onClick, className = '', disabled, destructive }: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick?.()}
      disabled={disabled}
      role="menuitem"
      className={`flex w-full items-center px-3 py-2 text-sm transition-colors ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : destructive
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-50'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <hr className="my-1 border-border" role="separator" />
}