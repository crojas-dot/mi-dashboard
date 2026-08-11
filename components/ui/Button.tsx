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

const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none'

const variantStyles: Record<string, React.CSSProperties> = {
  primary: { backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '6px' },
  secondary: { backgroundColor: '#fff', color: '#6c757d', border: '1px solid #dee2e6', borderRadius: '6px' },
  danger: { backgroundColor: '#fff', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '6px' },
  ghost: { backgroundColor: 'transparent', color: '#6c757d', border: 'none', borderRadius: '6px' },
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '0.25rem 0.5rem', fontSize: '0.875rem' },
  md: { padding: '0.375rem 0.75rem', fontSize: '0.875rem' },
}

export default function Button({ variant = 'primary', size = 'md', loading, disabled, onClick, type = 'button', className = '', children }: ButtonProps) {
  const style = { ...variantStyles[variant], ...sizeStyles[size] }

  return (
    <button
      type={type}
      className={`${base} ${className}`}
      style={style}
      disabled={disabled || loading}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!disabled) {
          const t = e.currentTarget
          if (variant === 'primary') t.style.backgroundColor = '#0b5ed7'
          else t.style.backgroundColor = '#f8f9fa'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = variantStyles[variant].backgroundColor || '#0d6efd'
        }
      }}
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
