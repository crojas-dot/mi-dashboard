'use client'

import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

export default function Textarea({ className, ...props }: ComponentPropsWithRef<'textarea'>) {
  return <textarea {...props} className={cn(
    'tw:block tw:w-full tw:min-w-0 tw:resize-y tw:rounded-lg tw:border tw:border-border tw:shadow-sm tw:bg-surface tw:px-4 tw:py-3 tw:font-sans tw:text-base tw:leading-relaxed tw:text-foreground tw:select-text tw:placeholder:text-muted tw:focus:ring-2 tw:focus:ring-primary/30 tw:focus:border-primary tw:focus-visible:outline-none tw:aria-invalid:border-danger tw:aria-invalid:focus-visible:ring-2 tw:aria-invalid:focus-visible:ring-danger/30 tw:disabled:cursor-not-allowed tw:disabled:bg-muted/30 tw:disabled:opacity-60 tw:transition-all tw:duration-200',
    className,
  )} />
}