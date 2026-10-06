import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

export type LabelProps = ComponentPropsWithRef<'label'>

export function Label({ className, ...props }: LabelProps) {
  return <label {...props} className={cn('tw:block tw:mb-2 tw:font-sans tw:text-sm tw:font-semibold tw:leading-relaxed tw:text-foreground', className)} />
}

export default Label