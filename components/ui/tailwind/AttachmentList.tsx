import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'
export function AttachmentList({ className, ...props }: ComponentPropsWithRef<'ul'>) { return <ul {...props} className={cn('tw:m-0 tw:list-none tw:overflow-hidden tw:rounded-lg tw:border tw:border-border tw:p-0', className)} /> }
export function AttachmentItem({ className, ...props }: ComponentPropsWithRef<'li'>) { return <li {...props} className={cn('tw:border-b tw:border-border tw:bg-surface tw:px-4 tw:py-3 tw:last:border-b-0', className)} /> }
