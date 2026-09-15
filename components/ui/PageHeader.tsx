import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  children?: React.ReactNode
}

export default function PageHeader({ title, description, backHref, children }: PageHeaderProps) {
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
          {description && <p className="m-0 mt-0.5 text-[0.85rem] text-qms-muted">{description}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
