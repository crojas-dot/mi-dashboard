import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

export function Spinner({ className, size, color: _color, ...props }: ComponentPropsWithRef<'span'> & { size?: 'sm' | 'md' | 'lg'; color?: string }) {
  void _color
  return <span role="status" aria-label="Cargando" {...props} className={cn('tw:inline-block tw:shrink-0 tw:animate-spin tw:rounded-full tw:border-3 tw:border-primary tw:border-r-transparent tw:motion-reduce:animate-none', size === 'sm' ? 'tw:size-5' : size === 'lg' ? 'tw:size-10' : 'tw:size-8', className)} />
}