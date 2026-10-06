import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

export function DataTable({ className, align: _align, hover: _hover, small, responsive, striped, bordered, ...props }: Omit<ComponentPropsWithRef<'table'>, 'align'> & { align?: string; hover?: boolean; small?: boolean; responsive?: boolean; striped?: boolean; bordered?: boolean }) {
  void _align; void _hover
  const table = <table {...props} className={cn('tw:w-full tw:border-collapse tw:text-base tw:leading-relaxed tw:[&_tbody_tr]:hover:bg-primary/5', small && 'tw:[&_td]:py-2.5 tw:[&_th]:py-2.5', striped && 'tw:[&_tbody_tr:nth-child(odd)]:bg-muted/30', bordered && 'tw:[&_td]:border tw:[&_th]:border tw:border-border', className)} />
  return responsive ? <div data-slot="table-scroll" className="tw:overflow-auto tw:overscroll-contain tw:[contain:paint] tw:rounded-xl tw:border tw:border-border tw:shadow-sm">{table}</div> : table
}