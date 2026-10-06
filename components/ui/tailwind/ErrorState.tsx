'use client'

import { useId } from 'react'
import { getUserError } from '@/lib/errors/userError'
import Button from './Button'
import { cn } from './cn'

interface ErrorStateProps { error: unknown; title: string; onRetry?: () => void; retrying?: boolean; className?: string }
export default function ErrorState({ error, title, onRetry, retrying, className }: ErrorStateProps) {
  const id = useId()
  const info = getUserError(error)
  return <section role="alert" aria-labelledby={id} className={cn('tw:rounded-xl tw:border-2 tw:border-soft-red-bg tw:bg-soft-red-bg/50 tw:p-5 tw:font-sans tw:text-base tw:leading-relaxed tw:text-soft-red-text tw:shadow-sm', className)}>
    <div className="tw:flex tw:items-start tw:gap-3">
      <svg className="tw:size-5 tw:shrink-0 tw:mt-0.5 tw:text-soft-red-text" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
      <div className="tw:flex-1">
        <h2 id={id} className="tw:mb-1.5 tw:mt-0 tw:text-lg tw:font-semibold">{title}</h2>
        <p className="tw:mb-1 tw:mt-0">{info.message}</p><p className="tw:mb-3 tw:mt-0 tw:text-sm">{info.action}</p>
        {info.code && <small className="tw:block tw:text-sm tw:opacity-70">Código: {info.code}</small>}
        {onRetry && <Button variant="outline" className="tw:mt-3" onClick={onRetry} loading={retrying}>Reintentar</Button>}
      </div>
    </div>
  </section>
}