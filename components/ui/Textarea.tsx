import type { ComponentPropsWithRef } from 'react'

export default function Textarea({ className = '', ...props }: ComponentPropsWithRef<'textarea'>) {
  return <textarea {...props} className={`ui-textarea ${className}`} />
}
