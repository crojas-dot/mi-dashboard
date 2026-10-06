import type { ComponentPropsWithRef } from 'react'

export default function Input({ className = '', ...props }: ComponentPropsWithRef<'input'>) {
  return <input {...props} className={`ui-field ${className}`} />
}
