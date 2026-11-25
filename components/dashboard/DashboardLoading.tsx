import Skeleton from '@/components/ui/Skeleton'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { CARD, KPI_GRID, KPI_ROW, KPI_RING, MAIN_GRID, LOWER_GRID, dashboardGeometry } from './QuejasSummary'

export default function DashboardLoading({ label = 'Cargando información…', className = '', framed = true, variant = 'modules' }: {
  label?: string
  className?: string
  framed?: boolean
  variant?: 'summary' | 'modules' | 'table' | 'activity' | 'executive'
}) {
  if (variant === 'executive') return <div role="status" aria-busy="true" className={`@container space-y-4 ${className}`}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse [animation-duration:2.4s]">
      <div className={KPI_GRID}>{Array.from({ length: 4 }, (_, i) => <div key={i} className={CARD + ' ' + dashboardGeometry.kpi}>
        <Skeleton className="h-5 w-3/4" />
        {i === 3 ? <><Skeleton className="mt-2 h-9 w-20" /><Skeleton className="mt-3 h-3.5 w-full" /><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">{Array.from({length: 4}, (_, j) => <Skeleton key={j} className="h-4 w-full" />)}</div></> :
          <div className={KPI_ROW}><div className="min-w-0 space-y-2"><Skeleton className={i === 1 ? 'h-8 w-3/4' : 'h-4 w-full'} /><Skeleton className="h-4 w-4/5" /></div><div className={KPI_RING + ' rounded-full border-[8px] border-qms-primary/[0.07]'} /></div>}
      </div>)}</div>
      <div className={MAIN_GRID}><div className={CARD + ' ' + dashboardGeometry.main}><Skeleton className="h-5 w-40" /><div className="mt-5 flex h-60 items-end justify-around gap-2">{Array.from({length: 6}, (_, i) => <Skeleton key={i} className={'w-7 ' + ['h-16','h-32','h-24','h-48','h-24','h-40'][i]} />)}</div></div><div className={CARD + ' ' + dashboardGeometry.main}><Skeleton className="h-5 w-40" /><div className="mt-5 flex flex-wrap items-center justify-center gap-5"><div className="size-[200px] max-w-full shrink-0 rounded-full border-[16px] border-qms-primary/[0.07]" /><div className="min-w-0 flex-1 basis-[180px] space-y-3">{Array.from({length: 6}, (_,i) => <Skeleton key={i} className="h-4 w-full" />)}</div></div></div></div>
      <div className={LOWER_GRID}>{[0,1].map(i => <div key={i} className={CARD + ' ' + dashboardGeometry.lower}><Skeleton className="h-5 w-40" /><div className="mt-5 space-y-4">{Array.from({length: i ? 4 : 5}, (_, j) => <Skeleton key={j} className="h-4 w-4/5" />)}</div></div>)}</div>
    </div>
  </div>
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
