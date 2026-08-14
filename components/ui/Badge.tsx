interface BadgeProps { variant: string; children: React.ReactNode }

const variants: Record<string, string> = {
  red: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  purple: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  gray: 'bg-muted text-muted-foreground',
}

export default function Badge({ variant, children }: BadgeProps) {
  return <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${variants[variant] || variants.gray}`}>{children}</span>
}
