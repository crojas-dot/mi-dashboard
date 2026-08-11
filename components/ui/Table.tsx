export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg shadow-sm" style={{ border: '1px solid #dee2e6' }}>
      <table className="w-full text-left" style={{ fontSize: '0.85rem' }}>{children}</table>
    </div>
  )
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>
}

export function TableHeaderCell({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left font-semibold text-white whitespace-nowrap ${className}`}
      style={{ whiteSpace: 'nowrap', backgroundColor: '#343a40', borderBottom: 'none', fontWeight: 600, fontSize: '0.8125rem' }}
    >
      {children}
    </th>
  )
}

export function TableRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: '1px solid #dee2e6', cursor: onClick ? 'pointer' : '' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TableCell({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <td className={`px-3 py-2 align-middle ${className}`} style={{ color: '#212529', ...style }}>
      {children}
    </td>
  )
}