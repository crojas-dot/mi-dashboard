'use client'

import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

interface SwitchProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export default function Switch({ checked, onChange, label, className, ...props }: SwitchProps) {
  return <input {...props} type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} className={cn(
    'tw:relative tw:h-7 tw:w-13 tw:shrink-0 tw:appearance-none tw:rounded-full tw:border-2 tw:border-border tw:bg-muted tw:cursor-pointer tw:before:absolute tw:before:left-0.5 tw:before:top-0.5 tw:before:size-6 tw:before:rounded-full tw:before:bg-white tw:before:shadow-lg tw:before:content-[\"\"] tw:checked:border-primary tw:checked:bg-primary tw:checked:before:translate-x-6 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-primary tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:transition-all tw:duration-200',
    className,
  )} />
}