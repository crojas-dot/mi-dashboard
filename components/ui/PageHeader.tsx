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
          <Link href={backHref} className="rounded-lg p-1.5 transition-colors no-underline" style={{ color: '#6c757d' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div>
          <h1 className="font-bold m-0" style={{ fontSize: '1.75rem', color: '#212529' }}>{title}</h1>
          {description && <p className="m-0 mt-0.5" style={{ color: '#6c757d', fontSize: '0.85rem' }}>{description}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
