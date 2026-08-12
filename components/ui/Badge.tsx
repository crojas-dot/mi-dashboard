interface BadgeProps {
  variant: string
  children: React.ReactNode
}

const variants: Record<string, string> = {
  red: '#dc3545',
  amber: '#e0a800',
  green: '#198754',
  blue: '#0d6efd',
  orange: '#fd7e14',
  purple: '#6f42c1',
  gray: '#6c757d',
}

export default function Badge({ variant, children }: BadgeProps) {
  const bg = variants[variant] || variants.gray
  return (
    <span
      className="inline-flex items-center justify-center rounded font-semibold text-white"
      style={{ backgroundColor: bg, padding: '0.2em 0.5em', fontSize: '0.75rem', lineHeight: 1.4 }}
    >
      {children}
    </span>
  )
}