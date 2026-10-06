'use client'

import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

/** Presentación de tabla HTML. Filtros, datos y paginación pertenecen a la vista. */
export function Table({ className, ...props }: ComponentPropsWithRef<'table'>) {
  return <div className="tw:overflow-auto tw:overscroll-contain tw:[contain:paint] tw:rounded-xl tw:border tw:border-border tw:shadow-sm"><table {...props} className={cn('tw:w-full tw:border-collapse tw:text-base tw:leading-relaxed', className)} /></div>
}
export function TableHead({ className, ...props }: ComponentPropsWithRef<'thead'>) {
  return <thead {...props} className={cn('tw:bg-gradient-to-r tw:from-primary/10 tw:to-primary/5 tw:text-foreground tw:font-semibold', className)} />
}
export function TableHeaderCell({ className, scope = 'col', ...props }: ComponentPropsWithRef<'th'>) {
  return <th {...props} scope={scope} className={cn('tw:border-b tw:border-border tw:px-4 tw:py-4 tw:text-left tw:align-middle tw:text-sm tw:uppercase tw:tracking-wider tw:whitespace-nowrap', className)} />
}
interface TableRowProps extends Omit<ComponentPropsWithRef<'tr'>, 'onClick'> { onClick?: () => void }
export function TableRow({ className, onClick, onKeyDown, tabIndex, ...props }: TableRowProps) {
  return <tr {...props} tabIndex={tabIndex ?? (onClick ? 0 : undefined)} onClick={onClick} onKeyDown={(event) => {
    onKeyDown?.(event)
    if (onClick && !event.defaultPrevented && event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
      event.preventDefault()
      onClick()
    }
  }} className={cn('tw:transition-colors tw:hover:bg-primary/5', onClick && 'tw:cursor-pointer tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-primary', className)} />
}
export function TableCell({ className, ...props }: ComponentPropsWithRef<'td'>) {
  return <td {...props} className={cn('tw:border-b tw:border-border/50 tw:px-4 tw:py-4 tw:align-middle tw:text-base tw:text-foreground', className)} />
}