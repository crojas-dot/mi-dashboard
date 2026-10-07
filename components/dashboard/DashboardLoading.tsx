import Skeleton from '@/components/ui/Skeleton'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'

export default function DashboardLoading({ label = 'Cargando información…', className = '', framed = true, variant = 'modules' }: {
  label?: string
  className?: string
  framed?: boolean
  variant?: 'summary' | 'modules' | 'table' | 'activity'
}) {
  if (variant === 'table' || variant === 'activity') {
    return <LoadingSkeleton variant={variant === 'activity' ? 'list' : 'table'} label={label} className={className} framed={framed} />
  }
  return <div role="status" aria-busy="true" className={`relative ${framed ? 'rounded-card border border-qms-border bg-qms-surface' : ''} ${className}`}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="motion-safe:animate-pulse [animation-duration:2.4s]">
      {variant === 'summary' ? <div className="grid grid-cols-1 divide-y divide-qms-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {[0, 1, 2].map(index => <div key={index} className="min-w-0 p-5">
          <Skeleton className="h-5 w-3/4 max-w-48" />
          {index < 2 ? <div className="mx-auto my-4 aspect-square w-full max-w-[200px] rounded-full border-[20px] border-qms-primary/[0.07]" />
            : <div className="my-6 space-y-6"><Skeleton className="h-10 w-20" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-5 w-full" /></div>}
          <div className="space-y-3"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-3/5" /><Skeleton className="h-3 w-2/3" /></div>
        </div>)}
      </div> : <div className="space-y-5 p-5">
        <Skeleton className="mb-6 h-6 w-44" />
        {[0, 1, 2, 3].map(index => <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[190px_minmax(0,1fr)_48px]">
          <Skeleton className="h-4 w-28" />
          <Skeleton className={`order-3 col-span-2 h-5 ${index % 2 ? 'w-2/3' : 'w-4/5'} sm:order-none sm:col-span-1`} />
          <Skeleton className="h-4 w-7 justify-self-end" />
        </div>)}
      </div>}
    </div>
  </div>
}
