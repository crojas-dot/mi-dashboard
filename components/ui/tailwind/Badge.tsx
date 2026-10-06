import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

const variants = {
  primary: 'tw:bg-soft-blue-bg tw:text-soft-blue-text tw:border tw:border-blue-200 tw:font-semibold',
  secondary: 'tw:bg-soft-gray-bg tw:text-soft-gray-text tw:border tw:border-slate-200 tw:font-medium',
  danger: 'tw:bg-soft-red-bg tw:text-soft-red-text tw:border tw:border-red-200 tw:font-semibold',
  success: 'tw:bg-soft-green-bg tw:text-soft-green-text tw:border tw:border-green-200 tw:font-semibold',
  warning: 'tw:bg-soft-amber-bg tw:text-soft-amber-text tw:border tw:border-amber-200 tw:font-semibold',
  info: 'tw:bg-soft-cyan-bg tw:text-soft-cyan-text tw:border tw:border-cyan-200 tw:font-semibold',
  purple: 'tw:bg-soft-purple-bg tw:text-soft-purple-text tw:border tw:border-purple-200 tw:font-semibold',
  pink: 'tw:bg-soft-pink-bg tw:text-soft-pink-text tw:border tw:border-pink-200 tw:font-semibold',
  indigo: 'tw:bg-soft-indigo-bg tw:text-soft-indigo-text tw:border tw:border-indigo-200 tw:font-semibold',
  default: 'tw:bg-soft-blue-bg tw:text-soft-blue-text tw:border tw:border-blue-200 tw:font-semibold',
} as const

const aliases = {
  red: 'danger', amber: 'warning', orange: 'warning', green: 'success',
  blue: 'info', cyan: 'info', purple: 'purple', pink: 'pink', indigo: 'indigo',
  gray: 'secondary', grey: 'secondary', default: 'primary',
} as const

export interface BadgeProps extends ComponentPropsWithRef<'span'> {
  variant?: keyof typeof variants | keyof typeof aliases | (string & {})
  size?: 'sm' | 'md' | 'lg'
}

export function Badge({ variant = 'primary', size = 'md', className, ...props }: BadgeProps) {
  const resolved = Object.hasOwn(aliases, variant) ? aliases[variant as keyof typeof aliases] : Object.hasOwn(variants, variant) ? variant as keyof typeof variants : 'primary'
  return <span data-slot="badge" {...props} className={cn(
    'tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-full tw:font-sans tw:leading-none',
    size === 'sm' ? 'tw:px-2.5 tw:py-0.5 tw:text-xs' : size === 'lg' ? 'tw:px-4 tw:py-1 tw:text-sm' : 'tw:px-3 tw:py-0.5 tw:text-sm',
    variants[resolved], className,
  )} />
}

export default Badge