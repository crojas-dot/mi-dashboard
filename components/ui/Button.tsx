'use client'

import { Loader2 } from 'lucide-react'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  children: React.ReactNode
}

const variants = {
  primary: 'border-primary bg-primary text-primary-foreground hover:brightness-95 shadow-sm',
  secondary: 'border-border bg-card text-foreground hover:bg-muted',
  danger: 'border-destructive/35 bg-card text-destructive hover:bg-destructive hover:text-white',
  ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
}
const sizes = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-10 px-4 text-sm' }

export default function Button({ variant = 'primary', size = 'md', loading, disabled, onClick, type = 'button', className = '', children }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
