import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

const colors = {
  danger: 'tw:border-red-300 tw:bg-soft-red-bg tw:text-soft-red-text',
  primary: 'tw:border-blue-300 tw:bg-soft-blue-bg tw:text-soft-blue-text',
  warning: 'tw:border-amber-300 tw:bg-soft-amber-bg tw:text-soft-amber-text',
  success: 'tw:border-green-300 tw:bg-soft-green-bg tw:text-soft-green-text',
  info: 'tw:border-cyan-300 tw:bg-soft-cyan-bg tw:text-soft-cyan-text',
  purple: 'tw:border-purple-300 tw:bg-soft-purple-bg tw:text-soft-purple-text',
}

export function Alert({ color = 'primary', className, ...props }: ComponentPropsWithRef<'div'> & { color?: string }) {
  return <div role="alert" {...props} className={cn('tw:rounded-xl tw:border tw:p-5 tw:font-sans tw:text-base tw:leading-relaxed tw:shadow-sm', colors[color as keyof typeof colors] ?? colors.primary, className)} />
}