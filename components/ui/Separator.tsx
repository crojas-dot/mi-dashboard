'use client'

import { type HTMLAttributes } from 'react'

interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

export default function Separator({ orientation = 'horizontal', decorative = true, className = '', ...props }: SeparatorProps) {
  const baseClasses = orientation === 'horizontal' ? 'w-full h-px' : 'h-full w-px'

  return (
    <hr
      className={`${baseClasses} bg-border border-none ${className}`}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={orientation}
      {...props}
    />
  )
}