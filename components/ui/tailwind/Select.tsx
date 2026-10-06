'use client'

import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'size'> {
  size?: 'sm' | 'md' | 'lg'
  htmlSize?: number
}

export default function Select({ className, size = 'md', htmlSize, ...props }: SelectProps) {
  return <select {...props} size={htmlSize} className={cn(
    'tw:block tw:w-full tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:shadow-sm tw:bg-surface tw:font-sans tw:leading-relaxed tw:text-foreground tw:focus:ring-2 tw:focus:ring-primary/30 tw:focus:border-primary tw:focus-visible:outline-none tw:aria-invalid:border-danger tw:aria-invalid:focus-visible:ring-2 tw:aria-invalid:focus-visible:ring-danger/30 tw:disabled:cursor-not-allowed tw:disabled:bg-muted/30 tw:disabled:opacity-60 tw:appearance-none tw:bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")] tw:bg-[right_0.75rem_center] tw:bg-no-repeat tw:pr-10 tw:transition-all tw:duration-200',
    size === 'sm' ? 'tw:min-h-9 tw:px-3.5 tw:py-1.5 tw:text-sm' : size === 'lg' ? 'tw:min-h-12 tw:px-5 tw:py-3 tw:text-lg' : 'tw:min-h-11 tw:px-4 tw:py-2.5 tw:text-base', className,
  )} />
}