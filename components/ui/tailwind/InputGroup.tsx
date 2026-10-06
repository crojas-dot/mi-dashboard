import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

export function InputGroup({ className, ...props }: ComponentPropsWithRef<'div'>) { return <div {...props} className={cn('tw:flex tw:min-w-0 tw:items-stretch tw:rounded-xl tw:border tw:border-border tw:bg-surface tw:shadow-sm', className)} /> }
export function InputAdornment({ className, ...props }: ComponentPropsWithRef<'span'>) { return <span {...props} className={cn('tw:inline-flex tw:items-center tw:rounded-l-xl tw:border-r tw:border-border tw:bg-muted/50 tw:px-4 tw:text-muted-foreground tw:[&_svg]:size-5', className)} /> }