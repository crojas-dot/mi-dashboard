import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

const colors = {
  primary: 'tw:bg-primary tw:dark:bg-primary',
  success: 'tw:bg-success tw:dark:bg-success',
  warning: 'tw:bg-warning tw:dark:bg-warning',
  danger: 'tw:bg-danger tw:dark:bg-danger',
  info: 'tw:bg-info tw:dark:bg-info',
  purple: 'tw:bg-purple tw:dark:bg-purple',
}

export function Progress({ value = 0, height = 10, color = 'primary', className, ...props }: Omit<ComponentPropsWithRef<'div'>, 'children'> & { value?: number; height?: number; color?: string }) {
  const bounded = Math.max(0, Math.min(100, value))
  return <div {...props} role="progressbar" aria-valuenow={bounded} aria-valuemin={0} aria-valuemax={100} className={cn('tw:overflow-hidden tw:rounded-full tw:bg-border tw:relative', className)} style={{ ...props.style, height }}><div className={cn('tw:h-full tw:rounded-full tw:transition-all tw:duration-500 tw:ease-out', colors[color as keyof typeof colors] ?? colors.primary)} style={{ width: `${bounded}%` }} /></div>
}