interface BadgeProps {
  variant: string
  children: React.ReactNode
}

const variants: Record<string, string> = {
  red: '#dc3545',
  amber: '#d97706',
  green: '#15803d',
  blue: '#1d4ed8',
  orange: '#c2410c',
  purple: '#6d28d9',
  gray: '#6b7280',
}

export default function Badge({ variant, children }: BadgeProps) {
  const bg = variants[variant] || variants.gray
  return (
    <span
      className="inline-flex items-center justify-center rounded font-semibold text-white"
      style={{ backgroundColor: bg, padding: '0.15em 0.4em', fontSize: '0.75rem', lineHeight: 1.4 }}
    >
      {children}
    </span>
  )
}