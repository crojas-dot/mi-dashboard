'use client'

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

const base = 'inline-flex items-center justify-center gap-2 rounded-button border font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none'

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'border-transparent bg-qms-primary text-white hover:bg-qms-primary-hover',
  secondary: 'border-qms-border bg-qms-surface text-qms-muted hover:bg-qms-hover-bg',
  danger: 'border-qms-danger bg-qms-surface text-qms-danger hover:bg-qms-danger hover:text-white',
  ghost: 'border-transparent bg-transparent text-qms-muted hover:bg-qms-hover-bg',
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-3 py-1.5 text-sm',
}

export default function Button({ variant = 'primary', size = 'md', loading, disabled, onClick, type = 'button', className = '', children }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && (
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
