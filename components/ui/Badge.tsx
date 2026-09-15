interface BadgeProps {
  variant: string
  children: React.ReactNode
}

const variants: Record<string, string> = {
  red: 'bg-qms-danger',
  amber: 'bg-qms-warning',
  green: 'bg-qms-success',
  blue: 'bg-qms-primary',
  orange: 'bg-qms-warning',
  purple: 'bg-qms-purple',
  gray: 'bg-qms-muted',
}

export default function Badge({ variant, children }: BadgeProps) {
  const backgroundClass = variants[variant] || variants.gray
  return (
    <span
      className={`inline-flex items-center justify-center rounded-button px-[0.5em] py-[0.2em] text-xs font-semibold leading-[1.4] text-white ${backgroundClass}`}
    >
      {children}
    </span>
  )
}