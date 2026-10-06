'use client'

import { forwardRef } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode
  wrapperClassName?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', wrapperClassName = '', children, style, ...props }, ref) => {
    return (
      <div className={`relative w-full min-w-0 ${wrapperClassName}`}>
        <select
          ref={ref}
          className={`ui-field appearance-none pr-9 ${className}`}
          style={style}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-qms-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
