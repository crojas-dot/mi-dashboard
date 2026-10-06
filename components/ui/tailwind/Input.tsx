'use client'

import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

const sizes = {
  sm: 'tw:min-h-9 tw:px-3.5 tw:py-1.5 tw:text-sm',
  md: 'tw:min-h-11 tw:px-4 tw:py-2.5 tw:text-base',
  lg: 'tw:min-h-12 tw:px-5 tw:py-3 tw:text-lg',
} as const

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  size?: keyof typeof sizes
  htmlSize?: number
}

export function Input({ size = 'md', htmlSize, className, type = 'text', ...props }: InputProps) {
  return <input {...props} type={type} size={htmlSize} className={cn(
    'tw:block tw:w-full tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:shadow-sm tw:bg-surface tw:font-sans tw:leading-relaxed tw:text-foreground tw:select-text tw:placeholder:text-muted tw:focus:ring-2 tw:focus:ring-primary/30 tw:focus:border-primary tw:focus-visible:outline-none tw:aria-invalid:border-danger tw:aria-invalid:focus-visible:ring-2 tw:aria-invalid:focus-visible:ring-danger/30 tw:disabled:cursor-not-allowed tw:disabled:bg-muted/30 tw:disabled:opacity-60 tw:transition-all tw:duration-200',
    sizes[size], className,
  )} />
}

export default Input