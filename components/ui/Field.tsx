import type { ReactNode } from 'react'

export default function Field({ id, label, hint, children, className = '' }: {
  id: string; label: string; hint?: string; children: ReactNode; className?: string
}) {
  return <div className={`min-w-0 ${className}`}>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-qms-dark">{label}</label>
    {children}
    {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-qms-muted">{hint}</p>}
  </div>
}
