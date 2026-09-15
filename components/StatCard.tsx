interface StatCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  color: 'blue' | 'amber' | 'green' | 'red' | 'purple'
  subtitle?: string
  trend?: { value: string; positive: boolean }
  onClick?: () => void
}

const colorStyles: Record<string, { color: string; bg: string }> = {
  blue: { color: 'text-qms-primary', bg: 'bg-soft-blue-bg' },
  amber: { color: 'text-qms-warning', bg: 'bg-soft-amber-bg' },
  green: { color: 'text-qms-success', bg: 'bg-soft-green-bg' },
  red: { color: 'text-qms-danger', bg: 'bg-soft-red-bg' },
  purple: { color: 'text-purple-600', bg: 'bg-soft-purple-bg' },
}

export default function StatCard({ title, value, icon, color, subtitle, trend, onClick }: StatCardProps) {
  const cs = colorStyles[color] || colorStyles.blue
  return (
    <div
      className={`rounded-card border border-qms-border bg-qms-surface p-4 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-1 text-[0.8125rem] font-medium text-qms-muted">{title}</p>
          <p className="text-[1.75rem] font-bold leading-none text-qms-dark">{value}</p>
          {subtitle && <p className="mt-1.5 text-xs text-qms-muted">{subtitle}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-qms-success' : 'text-qms-danger'}`}>
              {trend.value}
            </p>
          )}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${cs.bg} ${cs.color}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}