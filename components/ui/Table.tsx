export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"><table className="w-full min-w-max text-left text-sm">{children}</table></div>
}
export function TableHead({ children }: { children: React.ReactNode }) { return <thead className="bg-muted/70">{children}</thead> }
export function TableHeaderCell({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>
}
export function TableRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <tr onClick={onClick} tabIndex={onClick ? 0 : undefined} className={`border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50 ${onClick ? 'cursor-pointer focus-visible:bg-muted' : ''}`}>{children}</tr>
}
export function TableCell({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={`px-4 py-3 align-middle text-card-foreground ${className}`} style={style}>{children}</td>
}
