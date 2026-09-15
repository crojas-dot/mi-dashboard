export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-qms-border">
      <table className="w-full text-left text-[0.85rem]">{children}</table>
    </div>
  )
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>
}

export function TableHeaderCell({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`whitespace-nowrap bg-qms-header px-3 py-2 text-left text-[0.8125rem] font-semibold text-white ${className}`}
    >
      {children}
    </th>
  )
}

export function TableRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      className={`border-b border-qms-border transition-colors hover:bg-black/[0.03] ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TableCell({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <td className={`px-3 py-2 align-middle text-qms-dark ${className}`} style={style}>
      {children}
    </td>
  )
}