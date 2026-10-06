'use client'
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cn } from './cn'

export function Checkbox({ id, label, className, type = 'checkbox', ...props }: ComponentPropsWithRef<'input'> & { label?: ReactNode }) {
  const generated = useId(), inputId = id ?? generated
  const input = <input {...props} id={inputId} type={type} className={cn('tw:size-5 tw:shrink-0 tw:rounded tw:border-2 tw:border-border tw:cursor-pointer tw:accent-primary tw:focus:ring-2 tw:focus:ring-primary/30 tw:focus:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:transition-colors', className)} />
  return label ? <label htmlFor={inputId} className="tw:inline-flex tw:items-center tw:gap-2.5 tw:text-base tw:leading-relaxed tw:text-foreground tw:cursor-pointer">{input}{label}</label> : input
}