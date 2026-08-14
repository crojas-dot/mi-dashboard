import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PageHeaderProps { title: string; description?: string; backHref?: string; children?: React.ReactNode }

export default function PageHeader({ title, description, backHref, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backHref && <Link href={backHref} aria-label="Volver" className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" /></Link>}
        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
