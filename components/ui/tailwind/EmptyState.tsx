import type { ComponentPropsWithoutRef } from 'react'
import { cn } from './cn'

interface EmptyStateProps extends ComponentPropsWithoutRef<'td'> { message: string; icon?: React.ReactNode }
export default function EmptyState({ message, icon, colSpan = 999, className, ...props }: EmptyStateProps) {
  return <tr><td {...props} colSpan={colSpan} className={cn('tw:px-6 tw:py-16 tw:text-center', className)}><div className="tw:inline-flex tw:flex-col tw:items-center tw:gap-3">{icon && <div className="tw:text-muted-foreground tw:opacity-50">{icon}</div>}<p className="tw:m-0 tw:text-base tw:font-medium tw:text-foreground">{message}</p></div></td></tr>
}