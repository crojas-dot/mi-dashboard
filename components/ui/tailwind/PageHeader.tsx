import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PageHeader({ backHref, children }: { title?: string; description?: string; backHref?: string; children?: ReactNode }) {
  if (!backHref && !children) return null
  return <div className="tw:mb-6 tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-4">{backHref && <Link href={backHref} aria-label="Volver" className="tw:me-auto tw:inline-flex tw:size-11 tw:items-center tw:justify-center tw:rounded-lg tw:text-muted-foreground tw:hover:bg-hover tw:hover:text-foreground tw:focus:outline-none tw:focus:ring-2 tw:focus:ring-primary tw:transition-colors"><ArrowLeft aria-hidden="true" className="tw:size-5" /></Link>}{children && <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">{children}</div>}</div>
}