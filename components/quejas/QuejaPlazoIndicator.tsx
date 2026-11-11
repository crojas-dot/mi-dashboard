import type { ComponentPropsWithoutRef } from 'react'
import type { QuejaDeadline } from '@/lib/utils/quejaDeadline'
import { formatQuejaDeadlineDate } from '@/lib/utils/quejaDeadline'

const puntos = { gray: 'bg-qms-muted', green: 'bg-qms-success', amber: 'bg-qms-warning', red: 'bg-qms-danger' }

/** Conserva el texto y plazo calculados; el color es un apoyo, nunca la única señal. */
export default function QuejaPlazoIndicator({ deadline, className = '', title, ...props }: ComponentPropsWithoutRef<'span'> & { deadline: Pick<QuejaDeadline, 'vence' | 'variant' | 'label'> }) {
  const inactive = !deadline.vence
  return <span {...props} data-queja-deadline title={title ?? (deadline.vence ? `Fecha límite: ${formatQuejaDeadlineDate(deadline.vence)}` : undefined)} className={`inline-flex max-w-full items-center gap-2 text-sm ${inactive ? 'text-qms-muted' : 'text-qms-dark'} ${className}`}>
    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${puntos[inactive ? 'gray' : deadline.variant]}`} />
    <span className="min-w-0 break-words">{deadline.label}</span>
  </span>
}
