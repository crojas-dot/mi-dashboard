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
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-end gap-2">
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
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
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
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
