'use client'

import { forwardRef, type HTMLAttributes } from 'react'

interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  hideScrollbarX?: boolean
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ hideScrollbarX, className = '', children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`monday-scroll ${hideScrollbarX ? 'monday-scroll-no-x' : ''} ${className}`}
        style={style}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ScrollArea.displayName = 'ScrollArea'

export default ScrollArea