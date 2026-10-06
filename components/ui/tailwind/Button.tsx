'use client'

import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

const variants = {
  primary: 'tw:bg-primary tw:text-white tw:border tw:border-primary tw:hover:bg-primary-hover tw:focus:ring-4 tw:focus:ring-primary/30 tw:dark:focus:ring-primary/40 tw:shadow-sm tw:hover:shadow-md',
  secondary: 'tw:bg-surface tw:text-foreground tw:border tw:border-border tw:hover:bg-hover tw:focus:ring-4 tw:focus:ring-muted/30 tw:dark:border-border tw:dark:hover:bg-hover tw:shadow-sm',
  danger: 'tw:bg-danger tw:text-white tw:border tw:border-danger tw:hover:bg-danger-hover tw:focus:ring-4 tw:focus:ring-danger/30 tw:dark:focus:ring-danger/40 tw:shadow-sm tw:hover:shadow-md',
  ghost: 'tw:bg-transparent tw:text-muted tw:border tw:border-transparent tw:hover:bg-hover tw:hover:text-foreground tw:focus:ring-4 tw:focus:ring-muted/30 tw:dark:text-muted tw:dark:hover:bg-hover tw:dark:hover:text-foreground',
  outline: 'tw:bg-transparent tw:text-primary tw:border tw:border-primary tw:hover:bg-primary-subtle tw:focus:ring-4 tw:focus:ring-primary/20 tw:dark:text-primary tw:dark:hover:bg-primary/20 tw:dark:focus:ring-primary/30',
} as const

const sizes = {
  sm: 'tw:min-h-9 tw:px-3.5 tw:py-1.5 tw:text-sm',
  md: 'tw:min-h-11 tw:px-5 tw:py-2.5 tw:text-base',
  lg: 'tw:min-h-12 tw:px-6 tw:py-3 tw:text-lg',
} as const

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  loadingLabel?: string
}

export function Button({
  variant = 'primary', size = 'md', loading = false,
  loadingLabel = 'Procesando', disabled, type = 'button',
  className, children, ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || props['aria-busy']}
      className={cn(
        'tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:rounded-lg tw:font-medium tw:leading-normal tw:whitespace-nowrap tw:cursor-pointer tw:focus:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-offset-2 tw:focus-visible:ring-primary tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:transition-all tw:duration-200',
        variants[variant], sizes[size], className,
      )}
    >
      {loading && <span aria-hidden="true" className="tw:size-4 tw:shrink-0 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-r-transparent tw:motion-reduce:animate-none" />}
      {children}
      {loading && <span role="status" className="tw:sr-only">{loadingLabel}</span>}
    </button>
  )
}

export default Button