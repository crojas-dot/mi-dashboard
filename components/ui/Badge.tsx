import type { ComponentPropsWithRef } from 'react'

interface BadgeProps extends ComponentPropsWithRef<'span'> {
  variant: string
  children: React.ReactNode
}

const variants: Record<string, string> = {
  red: 'bg-qms-danger',
  amber: 'bg-qms-warning text-qms-warning-text',
  green: 'bg-qms-success',
  blue: 'bg-qms-primary',
  orange: 'bg-qms-orange',
  purple: 'bg-qms-purple',
  gray: 'bg-qms-muted',
}

export default function Badge({ variant, children, className = '', ...props }: BadgeProps) {
  const backgroundClass = Object.hasOwn(variants, variant) ? variants[variant] : variants.gray
  return (
    <span
      {...props}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-button px-[0.5em] py-[0.2em] text-xs font-semibold leading-[1.4] ${variant === 'amber' ? '' : 'text-white'} ${backgroundClass} ${className}`}
    >
      {children}
    </span>
  )
}
