'use client'

import type { ComponentPropsWithRef } from 'react'

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  loadingLabel?: string
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'ui-button-primary', secondary: 'ui-button-secondary',
  danger: 'ui-button-danger', ghost: 'ui-button-ghost', link: 'ui-button-link',
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'ui-button-sm', md: '', lg: 'ui-button-lg', icon: 'ui-button-icon',
}

export default function Button({ variant = 'primary', size = 'md', loading = false, loadingLabel = 'Guardando…', disabled, type = 'button', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`ui-button ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || props['aria-busy']}
    >
      {loading && (
        <svg aria-hidden="true" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {loading && <span role="status" className="sr-only">{loadingLabel}</span>}
      {children}
    </button>
  )
}
