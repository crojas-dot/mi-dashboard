const dotColors: Record<string, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
  gray: 'bg-slate-500',
}

interface StatusDotProps {
  variant?: string
}

export default function StatusDot({ variant = 'gray' }: StatusDotProps) {
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColors[variant] || dotColors.gray}`} />
  )
}
