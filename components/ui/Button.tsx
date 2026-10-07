'use client'

import type { ComponentPropsWithRef } from 'react'
import Spinner from '@/components/ui/Spinner'

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
      className={`ui-button relative ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || props['aria-busy']}
    >
      {loading && <Spinner />}
      {loading && <span role="status" className="sr-only">{loadingLabel}</span>}
      {children}
    </button>
  )
}
