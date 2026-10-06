import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

export type CardProps = ComponentPropsWithRef<'div'>

export function Card({ className, ...props }: CardProps) {
  return <div {...props} className={cn('tw:bg-surface tw:border tw:border-border tw:shadow-md tw:rounded-xl tw:font-sans tw:text-foreground', className)} />
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div {...props} className={cn('tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-4 tw:rounded-t-xl tw:border-b tw:border-border tw:bg-gradient-to-r tw:from-primary/5 tw:to-transparent tw:px-6 tw:py-5', className)} />
}

export function CardTitle({ className, ...props }: ComponentPropsWithRef<'h2'>) {
  return <h2 {...props} className={cn('tw:m-0 tw:text-xl tw:font-semibold tw:leading-tight tw:text-foreground', className)} />
}

export function CardContent({ className, ...props }: CardProps) {
  return <div {...props} className={cn('tw:p-6', className)} />
}

export function CardFooter({ className, ...props }: CardProps) {
  return <div {...props} className={cn('tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-3 tw:rounded-b-xl tw:border-t tw:border-border tw:bg-gradient-to-r tw:from-muted/5 tw:to-transparent tw:px-6 tw:py-4', className)} />
}

export default Card