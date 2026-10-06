import { CBadge } from '@coreui/react'
const colors: Record<string, string> = { primary:'primary', info:'info', success:'success', warning:'warning', danger:'danger', secondary:'secondary', red: 'danger', amber: 'warning', orange: 'warning', green: 'success', blue: 'info', purple: 'primary', gray: 'secondary' }
export default function Badge({ variant, children }: { variant: string; children: React.ReactNode }) {
  return <CBadge color={colors[variant] ?? 'secondary'} className="fw-medium" style={{ fontSize: '.875rem', lineHeight: 1.4 }} textColor={['amber','orange','warning'].includes(variant) ? 'dark' : undefined}>{children}</CBadge>
}
