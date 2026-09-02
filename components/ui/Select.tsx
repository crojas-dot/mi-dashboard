'use client'

import { forwardRef } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, style, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={`appearance-none rounded-lg border bg-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full ${className}`}
          style={{ padding: '0.5rem 2rem 0.5rem 0.75rem', cursor: 'pointer', color: '#212529', borderColor: '#dee2e6', ...style }}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
          style={{ width: '14px', height: '14px', color: '#6c757d' }}
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
