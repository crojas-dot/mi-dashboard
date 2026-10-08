import type { ComponentPropsWithRef } from 'react'
import { estiloBadge } from '@/lib/constants/badges'

interface BadgeProps extends ComponentPropsWithRef<'span'> {
  variant: string
  children: React.ReactNode
}

export default function Badge({ variant, children, className = '', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-button px-[0.5em] py-[0.2em] text-xs font-semibold leading-[1.4] ${estiloBadge(variant)} ${className}`}
    >
      {children}
    </span>
  )
}
