'use client'

import { useId, useState, type ReactNode } from 'react'
import type { CountMetric, DashboardMetrics } from '@/lib/utils/dashboardQuejas'

const fmt = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 1 })
const monthFmt = new Intl.DateTimeFormat('es-CR', { month: 'short', timeZone: 'UTC' })
const colors = ['#024796', '#719AC9', '#D3A028', '#198754', '#91A49B', '#A5ABB3', '#D7DCE2']
const primary = '#024796', success = '#198754', warning = '#D3A028', track = '#E9EDF1'
const shortStates = ['Recibido', 'Investigación', 'Revisión GC', 'Resuelto', 'Finalizado', 'No procede', 'Otros']
const percent = (m: CountMetric) => m.total > 0 ? m.good / m.total * 100 : null
const pct = (value: number | null) => value === null ? '—' : fmt.format(value) + ' %'

export const CARD = 'min-w-0 rounded-card border border-qms-border bg-qms-surface p-4 sm:p-5 print:p-3 print:rounded-lg print:border-slate-200 print:bg-white print:shadow-none print:break-inside-avoid'
export const KPI_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 @min-[1120px]:grid-cols-4 print:grid-cols-4 print:gap-3'
export const MAIN_GRID = 'grid grid-cols-1 gap-4 @min-[1000px]:grid-cols-[minmax(0,13fr)_minmax(0,7fr)] print:grid-cols-[1.65fr_1fr] print:gap-3'
export const LOWER_GRID = 'grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-3'
const KPI_HEIGHT = 'min-h-[184px] sm:py-4'
export const KPI_ROW = 'mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3'
export const KPI_RING = 'aspect-square w-[clamp(88px,8cqw,116px)] shrink-0 print:w-14 print:h-14'
const MAIN_HEIGHT = 'min-h-[350px]'
const LOWER_HEIGHT = 'min-h-[270px]'
export const dashboardGeometry = { kpi: KPI_HEIGHT, main: MAIN_HEIGHT, lower: LOWER_HEIGHT }

function Ring({ metric, color, label }: { metric: CountMetric; color: string; label: string }) {
  const p = percent(metric)
  return <svg viewBox="0 0 120 120" data-dashboard-kpi-ring className={KPI_RING} role="img" aria-label={label + ': ' + pct(p) + (metric.total ? ' (' + metric.good + ' de ' + metric.total + ')' : ', sin datos evaluables')}>
    <circle cx="60" cy="60" r="50" fill="none" stroke={track} strokeWidth="8" />
    {p !== null && p > 0 && <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={p + ' ' + (100 - p)} transform="rotate(-90 60 60)" />}
    <text x="60" y="61" dominantBaseline="middle" textAnchor="middle" className="fill-qms-dark text-[22px] font-semibold">{p === null ? '—' : fmt.format(p) + '%'}</text>
  </svg>
}
function Card({ title, height, children }: { title: string; height: string; children: ReactNode }) {
  return <section className={CARD + ' ' + height}>
    <h2 className="text-lg font-semibold leading-snug text-qms-dark">{title}</h2>
    {children}
  </section>
}
function RatioKpi({ title, metric, target, suffix, breakdown, excluded = 0 }: { title: string; metric: CountMetric; target?: boolean; suffix?: string; breakdown?: boolean; excluded?: number }) {
  const p = percent(metric)
  const color = target ? p !== null && p >= 90 ? success : warning : primary
  return <Card title={title} height={KPI_HEIGHT}>
    <div data-dashboard-kpi-row className={KPI_ROW}>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug text-qms-dark">{metric.total ? breakdown ? <>{fmt.format(metric.good)} procedentes · {fmt.format(metric.total - metric.good)} no proceden</> : fmt.format(metric.good) + ' de ' + fmt.format(metric.total) + ' ' + suffix : 'Sin datos evaluables'}</p>
        {target && <p className="mt-1.5 text-sm text-qms-muted">Meta 90 %</p>}
        {excluded > 0 && <p className="mt-1 text-xs leading-snug text-qms-muted">{fmt.format(excluded)} sin plazo verificable</p>}
      </div>
      <Ring metric={metric} color={color} label={title} />
    </div>
  </Card>
}
function ActiveBar({ data }: { data: DashboardMetrics }) {
  const id = useId()
  return <div className="mt-2">
    <svg role="img" aria-label={data.distribution.slice(0, 4).map((s, i) => shortStates[i] + ': ' + s.count).join('; ')} viewBox="0 0 240 10" className="h-3.5 w-full" preserveAspectRatio="none">
      <defs><clipPath id={id}><rect width="240" height="10" rx="5" /></clipPath></defs>
      <rect width="240" height="10" rx="5" fill={track} />
      <g clipPath={'url(#' + id + ')'}>{data.distribution.slice(0, 4).map((s, i) => {
        const width = data.active ? s.count / data.active * 240 : 0
        const x = data.active ? data.distribution.slice(0, i).reduce((sum, item) => sum + item.count, 0) / data.active * 240 : 0
        return <rect key={s.state} x={x} width={width} height="10" fill={colors[i]}><title>{shortStates[i]}: {s.count}</title></rect>
      })}</g>
    </svg>
    <div data-dashboard-active-legend className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-qms-muted print:grid-cols-2 print:gap-x-2 print:gap-y-1 print:text-[10px]">
      {data.distribution.slice(0, 4).map((s, i) => <span key={s.state} className="flex min-w-0 items-center gap-1 print:justify-between"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} /><span className="min-w-0 break-words">{shortStates[i]}</span><strong className="shrink-0 whitespace-nowrap tabular-nums text-qms-dark">{s.count}</strong></span>)}
    </div>
  </div>
}
function Trend({ data }: { data: DashboardMetrics }) {
  const [focused, setFocused] = useState<string | null>(null)
  const active = data.monthly.find(m => m.month === focused)
  const max = Math.max(1, ...data.monthly.flatMap(m => [m.received, m.resolvedOnTime]))
  const step = Math.max(1, Math.ceil(max / 3)), top = step * 3
  const width = 620, base = 218, plot = 180, left = 43, slot = (width - left - 10) / data.monthly.length
  const bar = Math.min(23, slot * .28)
  const labelSize = Math.min(12, Math.max(8, (bar + 2) / Math.max(1, String(max).length) / .62))
  const label = (month: string) => monthFmt.format(new Date(month + '-01T00:00:00Z')).replace('.', '')
  return <Card title="Tendencia mensual" height={MAIN_HEIGHT}>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-qms-muted">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-qms-primary" />Recibidos</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-qms-success" />Resueltos en plazo</span>
    </div>
    <div data-dashboard-trend-frame className="mt-3 print:mt-1 print:h-[175px]">
    <svg data-dashboard-trend viewBox="0 0 620 250" className="block h-auto w-full" role="group" aria-label="Volumen mensual por fecha de recepción y resolución">
      {[0, 1, 2, 3].map(n => <g key={n}><line x1={left} y1={base - n * plot / 3} x2="610" y2={base - n * plot / 3} stroke={track} /><text x="34" y={base - n * plot / 3 + 4} textAnchor="end" className="fill-qms-muted text-[14px]">{n * step}</text></g>)}
      {data.monthly.map((m, i) => {
        const x = left + slot * (i + .5), h1 = m.received / top * plot, h2 = m.resolvedOnTime / top * plot
        const description = label(m.month) + ': ' + m.received + ' recibidos; ' + (m.resolvedEvaluable ? m.resolvedOnTime + ' resueltos en plazo de ' + m.resolvedEvaluable + ' evaluables' : 'sin resoluciones evaluables')
        return <g key={m.month} tabIndex={0} role="img" aria-label={description} className="cursor-default focus:outline-none"
          onMouseEnter={() => setFocused(m.month)} onMouseLeave={() => setFocused(null)} onFocus={() => setFocused(m.month)} onBlur={() => setFocused(null)}>
          <title>{description}</title>
          <rect x={x - slot / 2 + 2} y="24" width={slot - 4} height="197" rx="5" fill={focused === m.month ? '#F0F4F8' : 'transparent'} />
          <rect x={x - bar - 1} y={base - h1} width={bar} height={h1} rx="3" fill={primary} />
          {m.resolvedEvaluable > 0 && <rect x={x + 1} y={base - h2} width={bar} height={h2} rx="3" fill={success} />}
          {m.received > 0 && <text x={x - bar / 2 - 1} y={base - h1 - 5} textAnchor="middle" fontSize={labelSize} className="fill-qms-muted font-medium tabular-nums">{m.received}</text>}
          {m.resolvedEvaluable > 0 && m.resolvedOnTime > 0 && <text x={x + bar / 2 + 1} y={base - h2 - 5} textAnchor="middle" fontSize={labelSize} className="fill-qms-muted font-medium tabular-nums">{m.resolvedOnTime}</text>}
          <text x={x} y="240" textAnchor="middle" className="fill-qms-muted text-[14px]">{label(m.month)}</text>
        </g>
      })}
    </svg>
    </div>
    <p data-dashboard-trend-note aria-live="polite" className="mt-2 min-h-5 text-center text-sm text-qms-muted">{active ? label(active.month) + ' · ' + active.received + ' recibidos · ' + (active.resolvedEvaluable ? active.resolvedOnTime + '/' + active.resolvedEvaluable + ' en plazo' : 'Sin resoluciones evaluables') : data.resolution.total ? '' : 'Sin resoluciones evaluables en el período'}</p>
  </Card>
}
function Distribution({ data }: { data: DashboardMetrics }) {
  const total = data.received
  return <Card title="Distribución por estado" height={MAIN_HEIGHT}>
    <div data-dashboard-distribution className="mt-5 flex flex-wrap items-center justify-center gap-5">
      <svg data-dashboard-donut viewBox="0 0 132 132" className="w-[200px] max-w-full shrink-0" role="img" aria-label={total + ' solicitudes del período'}>
        <circle cx="66" cy="66" r="54" fill="none" stroke={track} strokeWidth="11" />
        {data.distribution.map((s, i) => {
          const p = total ? s.count / total * 100 : 0
          const at = total ? data.distribution.slice(0, i).reduce((sum, item) => sum + item.count, 0) / total * 100 : 0
          return p > 0 && <circle key={s.state} cx="66" cy="66" r="54" fill="none" stroke={colors[i]} strokeWidth="11" pathLength="100" strokeDasharray={p + ' ' + (100 - p)} strokeDashoffset={-at} transform="rotate(-90 66 66)"><title>{shortStates[i]}: {s.count} ({pct(p)})</title></circle>
        })}
        <text x="66" y="60" textAnchor="middle" className="fill-qms-dark text-[26px] font-semibold">{fmt.format(total)}</text>
        <text x="66" y="78" textAnchor="middle" className="fill-qms-muted text-[10px]">Solicitudes</text>
      </svg>
      <ul data-dashboard-distribution-legend className="min-w-0 flex-1 basis-[180px] space-y-2">
        {data.distribution.filter(s => s.state !== 'Otros' || s.count > 0).map(s => {
          const i = data.distribution.indexOf(s)
          return <li key={s.state} className="flex min-w-0 items-center gap-1.5 text-sm text-qms-muted"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} /><span className="flex-1">{shortStates[i]}</span><span className="shrink-0 whitespace-nowrap tabular-nums text-qms-muted"><strong className="font-semibold text-qms-dark">{fmt.format(s.count)}</strong>{total > 0 ? ' (' + fmt.format(s.count / total * 100) + '%)' : ' (—)'}</span></li>
        })}
      </ul>
    </div>
  </Card>
}
function Areas({ data }: { data: DashboardMetrics }) {
  const max = Math.max(1, ...data.areas.map(a => a.count))
  return <Card title="Top áreas afectadas" height={LOWER_HEIGHT}>
    <p className="mt-1 text-sm text-qms-muted">Solicitudes procedentes · Top 5</p>
    {data.areas.length ? <ul data-dashboard-areas className="mt-4 space-y-3">{data.areas.map(a => <li key={a.area} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(64px,1fr)_auto] items-center gap-2 text-sm">
      <span data-dashboard-area-name className="truncate text-qms-dark" title={a.area}>{a.area}</span><svg role="img" aria-label={a.area + ': ' + a.count} viewBox="0 0 100 7" preserveAspectRatio="none" className="h-3.5 w-full"><rect width="100" height="7" rx="3.5" fill={track} /><rect width={a.count / max * 100} height="7" rx="3.5" fill={primary} /></svg><strong className="tabular-nums">{a.count}</strong>
    </li>)}</ul> : <p className="py-9 text-center text-sm text-qms-muted">Sin áreas registradas en solicitudes procedentes.</p>}
  </Card>
}
function Stage({ label, metric, showTarget = false }: { label: string; metric: CountMetric; showTarget?: boolean }) {
  const p = percent(metric)
  return <div>
    <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium text-qms-dark">{label}</span><strong className="tabular-nums text-qms-dark">{pct(p)}</strong></div>
    <div data-dashboard-stage-bar className={'relative mt-1.5' + (showTarget ? ' pt-5' : '')}>
      {showTarget && <span className="absolute right-[10%] top-0 whitespace-nowrap text-xs font-medium text-qms-muted">Meta 90%</span>}
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="block h-3.5 w-full" role="img" aria-label={label + ': ' + pct(p) + ', meta 90 %'}>
      <rect width="100" height="8" rx="4" fill={track} />
      {p !== null && p > 0 && <rect width={p} height="8" rx="4" fill={p >= 90 ? success : warning} />}
      <line x1="90" x2="90" y1="0" y2="8" stroke="#596675" strokeWidth=".8" />
    </svg>
    </div>
    <p className="mt-1 text-sm text-qms-muted">{metric.total ? metric.good + ' de ' + metric.total + ' a tiempo' : 'Sin datos evaluables'}</p>
  </div>
}
export default function QuejasSummary({ data }: { data: DashboardMetrics }) {
  return <div data-dashboard-graphics className="@container space-y-4 print:space-y-3">
    <div className={KPI_GRID}>
      <RatioKpi title="Cumplimiento de plazos" metric={data.resolution} target suffix="en plazo" excluded={Math.max(0, data.observed - data.resolution.total)} />
      <Card title="Tiempo promedio de resolución" height={KPI_HEIGHT}><div data-dashboard-kpi-row className={KPI_ROW}><div className="min-w-0"><p className="text-4xl font-semibold tabular-nums text-qms-dark">{data.average === null ? '—' : fmt.format(data.average)}</p><p className="mt-1 text-sm text-qms-muted">días calendario<br />{data.durationTotal} resoluciones</p></div><svg viewBox="0 0 48 48" data-dashboard-kpi-ring className={KPI_RING} aria-hidden="true"><circle cx="24" cy="24" r="19" fill="none" stroke={track} strokeWidth="4" /><path d="M24 12V24L32 29" fill="none" stroke={primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></div></Card>
      <RatioKpi title="Solicitudes procedentes" metric={data.procedure} breakdown />
      <Card title="Expedientes activos" height={KPI_HEIGHT}><p className="mt-1 text-4xl font-semibold tabular-nums text-qms-dark">{fmt.format(data.active)}</p><ActiveBar data={data} /></Card>
    </div>
    <div className={MAIN_GRID}><Trend data={data} /><Distribution data={data} /></div>
    <div className={LOWER_GRID}><Areas data={data} /><Card title="Cumplimiento por etapa" height={LOWER_HEIGHT}><div data-dashboard-stages className="mt-4 space-y-5"><Stage label="Evaluación · 3 días" metric={data.evaluation} showTarget /><Stage label="Investigación · 15 días" metric={data.investigation} /></div></Card></div>
  </div>
}
