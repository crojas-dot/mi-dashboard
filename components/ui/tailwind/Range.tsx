'use client'
import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

export function Range({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input {...props} type="range" className={cn('tw:block tw:w-full tw:h-2.5 tw:bg-border tw:rounded-full tw:appearance-none tw:cursor-pointer tw:accent-primary tw:focus:outline-none tw:focus:ring-2 tw:focus:ring-primary/30 tw:disabled:opacity-50 tw:transition-colors', className)} />
}