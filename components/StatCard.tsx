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
  blue: { color: '#0d6efd', bg: '#e7f1ff' },
  amber: { color: '#e0a800', bg: '#fff8e1' },
  green: { color: '#198754', bg: '#e8f5ee' },
  red: { color: '#dc3545', bg: '#fdeeee' },
  purple: { color: '#6f42c1', bg: '#f1ecf9' },
}

export default function StatCard({ title, value, icon, color, subtitle, trend, onClick }: StatCardProps) {
  const cs = colorStyles[color] || colorStyles.blue
  return (
    <div
      className={`rounded-lg border bg-white ${onClick ? 'cursor-pointer' : ''}`}
      style={{ borderColor: '#dee2e6', padding: '1rem' }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-1 font-medium" style={{ color: '#6c757d', fontSize: '0.8125rem' }}>{title}</p>
          <p className="font-bold leading-none" style={{ color: '#212529', fontSize: '1.75rem' }}>{value}</p>
          {subtitle && <p className="mt-1.5" style={{ color: '#6c757d', fontSize: '0.75rem' }}>{subtitle}</p>}
          {trend && (
            <p className={`mt-1 font-medium ${trend.positive ? '' : ''}`} style={{ color: trend.positive ? '#198754' : '#dc3545', fontSize: '0.75rem' }}>
              {trend.value}
            </p>
          )}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: cs.bg, color: cs.color }}>
          {icon}
        </div>
      </div>
    </div>
  )
}