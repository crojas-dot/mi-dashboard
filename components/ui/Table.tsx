import type { ComponentPropsWithRef } from 'react'

export function Table({ children, className = '', ...props }: ComponentPropsWithRef<'table'>) {
  return <div className="ui-panel overflow-x-auto overscroll-contain">
    <table {...props} className={`w-full select-text text-left text-base text-gray-700 ${className}`}>{children}</table>
  </div>
}

export function TableHead(props: ComponentPropsWithRef<'thead'>) {
  return <thead {...props} />
}

export function TableHeaderCell({ className = '', ...props }: ComponentPropsWithRef<'th'>) {
  return <th scope="col" {...props} className={`whitespace-nowrap border-b border-qms-border bg-qms-table-head px-3 py-3.5 text-left text-sm font-semibold text-gray-700 ${className}`} />
}

export function TableRow({ children, onClick, onKeyDown, tabIndex, className = '', ...props }: ComponentPropsWithRef<'tr'>) {
  return <tr {...props} tabIndex={tabIndex ?? (onClick ? 0 : undefined)} onClick={onClick}
    onKeyDown={event => {
      onKeyDown?.(event)
      if (event.defaultPrevented || event.target !== event.currentTarget || !onClick) return
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click() }
    }}
    className={`border-b border-qms-border hover:bg-qms-hover-bg ${onClick ? 'cursor-pointer' : ''} ${className}`}>{children}</tr>
}

export function TableCell({ className = '', ...props }: ComponentPropsWithRef<'td'>) {
  return <td {...props} className={`px-3 py-4 align-middle ${className}`} />
}
