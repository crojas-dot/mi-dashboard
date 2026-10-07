import Skeleton from '@/components/ui/Skeleton'

/** Cantidad fija de formas: independiente del volumen de registros y sin consultas. */
export default function LoadingSkeleton({ variant = 'table', label = 'Cargando información…', framed = true, className = '' }: {
  variant?: 'table' | 'form' | 'cards' | 'list'
  label?: string
  framed?: boolean
  className?: string
}) {
  return <div role="status" aria-busy="true" className={`relative min-w-0 overflow-hidden ${framed ? 'rounded-card border border-qms-border bg-qms-surface' : ''} ${className}`}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="motion-safe:animate-pulse [animation-duration:2.4s]">
      {variant === 'table' ? <div className="min-w-[640px]">
        <div className="grid grid-cols-5 gap-6 bg-qms-table-head px-4 py-4">{[0, 1, 2, 3, 4].map(column => <Skeleton key={column} className="h-4 w-3/4" />)}</div>
        {[0, 1, 2, 3, 4].map(row => <div key={row} className="grid grid-cols-5 items-center gap-6 border-t border-qms-border px-4 py-4">
          <Skeleton className="h-5 w-4/5" /><Skeleton className={`h-4 ${row % 2 ? 'w-3/5' : 'w-full'}`} /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-6 w-16" /><Skeleton className="h-4 w-3/5" />
        </div>)}
      </div> : variant === 'form' ? <div className="space-y-6 p-5 sm:p-6">
        <Skeleton className="h-6 w-2/3 max-w-60" />
        <div className="grid gap-5 sm:grid-cols-2">{[0, 1, 2, 3].map(index => <div key={index} className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-11 w-full" /></div>)}</div>
        <Skeleton className="h-20 w-full" /><Skeleton className="ml-auto h-11 w-32" />
      </div> : variant === 'cards' ? <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(index => <div key={index} className="space-y-5 rounded-card border border-qms-border p-5"><Skeleton className="h-8 w-8" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/5" /><Skeleton className="h-9 w-28" /></div>)}</div>
        : <div className="space-y-5 p-4">{[0, 1, 2].map(index => <div key={index} className="flex items-center gap-3"><Skeleton circle className="h-9 w-9 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className={`h-4 ${index % 2 ? 'w-3/5' : 'w-4/5'}`} /><Skeleton className="h-3 w-24" /></div></div>)}</div>}
    </div>
  </div>
}
