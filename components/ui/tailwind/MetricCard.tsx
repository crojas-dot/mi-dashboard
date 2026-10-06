import type { ComponentPropsWithRef, ReactNode } from 'react'
import Card from './Card'
import { cn } from './cn'

const colors = {
  primary: 'tw:bg-primary tw:dark:bg-primary',
  info: 'tw:bg-info tw:dark:bg-info',
  success: 'tw:bg-success tw:dark:bg-success',
  danger: 'tw:bg-danger tw:dark:bg-danger',
  warning: 'tw:bg-warning tw:dark:bg-warning',
  purple: 'tw:bg-purple tw:dark:bg-purple',
  cyan: 'tw:bg-cyan tw:dark:bg-cyan',
  pink: 'tw:bg-pink tw:dark:bg-pink',
}

export function MetricCard({ title, value, icon, color = 'primary', footer, className, ...props }: Omit<ComponentPropsWithRef<'div'>, 'title'> & { title: ReactNode; value: ReactNode; icon?: ReactNode; color?: string; footer?: ReactNode }) {
  return <Card {...props} className={cn('tw:h-full tw:overflow-hidden tw:transition-shadow tw:hover:shadow-lg', className)}>
    <div className="tw:flex tw:items-center tw:gap-4 tw:p-6">
      <div className={cn('tw:grid tw:size-16 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:text-white tw:shadow-lg', colors[color as keyof typeof colors] ?? colors.primary)}>
        {icon}
      </div>
      <div className="tw:min-w-0">
        <div className="tw:text-3xl tw:font-bold tw:leading-tight tw:text-foreground">{value}</div>
        <div className="tw:text-base tw:text-muted-foreground tw:font-medium">{title}</div>
      </div>
    </div>
    {footer && <div className="tw:border-t tw:border-border tw:bg-muted/30 tw:px-6 tw:py-4 tw:text-sm tw:text-muted-foreground">{footer}</div>}
  </Card>
}