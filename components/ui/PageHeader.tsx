import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  compact?: boolean
  children?: React.ReactNode
}

export default function PageHeader({ title, description, backHref, children, compact = true }: PageHeaderProps) {
  // Las vistas de trabajo conservan su título accesible sin repetir la cabecera del panel.
  // El dashboard puede solicitar el encabezado completo con compact={false}.
  if (compact) {
    return (
      <>
        <h1 className="sr-only">{title}</h1>
        {(backHref || children) && (
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-end gap-2 [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:min-h-10 sm:[&>button]:w-auto">
            {backHref && (
              <Link href={backHref} aria-label="Volver" className="mr-auto rounded-button p-1.5 text-qms-muted no-underline transition-colors hover:bg-qms-hover-bg">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            {children}
          </div>
        )}
      </>
    )
  }
  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        {backHref && (
          <Link href={backHref} className="rounded-button p-1.5 text-qms-muted no-underline transition-colors hover:bg-qms-hover-bg">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div>
          <h1 className="m-0 text-[1.75rem] font-bold text-qms-dark">{title}</h1>
          {description && <p className="m-0 mt-0.5 text-base text-qms-muted">{description}</p>}
        </div>
      </div>
      {children && <div className="flex w-full flex-wrap items-center gap-2 [&>button]:w-full sm:w-auto sm:[&>button]:w-auto">{children}</div>}
    </div>
  )
}
