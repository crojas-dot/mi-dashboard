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

export const CARD = 'min-w-0 rounded-card border border-qms-border bg-qms-surface p-3 sm:p-4'
export const KPI_GRID = 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'
export const MAIN_GRID = 'grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]'
export const LOWER_GRID = 'grid grid-cols-1 gap-3 lg:grid-cols-2'
const KPI_HEIGHT = 'min-h-[126px]'
const MAIN_HEIGHT = 'min-h-[240px]'
const LOWER_HEIGHT = 'min-h-[186px]'
export const dashboardGeometry = { kpi: KPI_HEIGHT, main: MAIN_HEIGHT, lower: LOWER_HEIGHT }

function Ring({ metric, color, label }: { metric: CountMetric; color: string; label: string }) {
  const p = percent(metric)
  return <svg viewBox="0 0 88 88" className="size-[76px] shrink-0" role="img" aria-label={label + ': ' + pct(p) + (metric.total ? ' (' + metric.good + ' de ' + metric.total + ')' : ', sin datos evaluables')}>
    <circle cx="44" cy="44" r="36" fill="none" stroke={track} strokeWidth="6" />
    {p !== null && p > 0 && <circle cx="44" cy="44" r="36" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray={p + ' ' + (100 - p)} transform="rotate(-90 44 44)" />}
    <text x="44" y="45" dominantBaseline="middle" textAnchor="middle" className="fill-qms-dark text-[15px] font-semibold">{p === null ? '—' : fmt.format(p) + '%'}</text>
  </svg>
}
function Card({ title, height, children }: { title: string; height: string; children: ReactNode }) {
  return <section className={CARD + ' ' + height}>
    <h2 className="text-sm font-semibold leading-snug text-qms-dark">{title}</h2>
    {children}
  </section>
}
function RatioKpi({ title, metric, target, detail }: { title: string; metric: CountMetric; target?: boolean; detail: string }) {
  const p = percent(metric)
  const color = target ? p !== null && p >= 90 ? success : warning : primary
  return <Card title={title} height={KPI_HEIGHT}>
    <div className="mt-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-qms-muted">{metric.total ? fmt.format(metric.good) + ' de ' + fmt.format(metric.total) : 'Sin datos evaluables'}</p>
        <p className="mt-1 text-xs text-qms-muted">{detail}</p>
        {target && <p className="mt-1 text-xs font-medium text-qms-dark">Meta 90 %</p>}
      </div>
      <Ring metric={metric} color={color} label={title} />
    </div>
  </Card>
}
function ActiveBar({ data }: { data: DashboardMetrics }) {
  const id = useId()
  return <div className="mt-2">
    <svg role="img" aria-label={data.distribution.slice(0, 4).map((s, i) => shortStates[i] + ': ' + s.count).join('; ')} viewBox="0 0 240 10" className="h-2.5 w-full" preserveAspectRatio="none">
      <defs><clipPath id={id}><rect width="240" height="10" rx="5" /></clipPath></defs>
      <rect width="240" height="10" rx="5" fill={track} />
      <g clipPath={'url(#' + id + ')'}>{data.distribution.slice(0, 4).map((s, i) => {
        const width = data.active ? s.count / data.active * 240 : 0
        const x = data.active ? data.distribution.slice(0, i).reduce((sum, item) => sum + item.count, 0) / data.active * 240 : 0
        return <rect key={s.state} x={x} width={width} height="10" fill={colors[i]}><title>{shortStates[i]}: {s.count}</title></rect>
      })}</g>
    </svg>
    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-qms-muted">
      {data.distribution.slice(0, 4).map((s, i) => <span key={s.state} className="flex min-w-0 items-center gap-1"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} />{shortStates[i]} <strong className="text-qms-dark">{s.count}</strong></span>)}
    </div>
  </div>
}
function Trend({ data }: { data: DashboardMetrics }) {
  const [focused, setFocused] = useState<string | null>(null)
  const active = data.monthly.find(m => m.month === focused)
  const max = Math.max(1, ...data.monthly.flatMap(m => [m.received, m.resolvedOnTime]))
  const step = Math.max(1, Math.ceil(max / 3)), top = step * 3
  const width = 620, base = 138, plot = 113, left = 37, slot = (width - left - 10) / data.monthly.length
  const bar = Math.min(18, slot * .28)
  const label = (month: string) => monthFmt.format(new Date(month + '-01T00:00:00Z')).replace('.', '')
  return <Card title="Tendencia mensual" height={MAIN_HEIGHT}>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-qms-muted">
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-qms-primary" />Recibidos</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-qms-success" />Resueltos en plazo</span>
    </div>
    <svg viewBox="0 0 620 170" className="mt-1 block h-auto max-h-[172px] w-full" role="group" aria-label="Volumen mensual por fecha de recepción y resolución">
      {[0, 1, 2, 3].map(n => <g key={n}><line x1={left} y1={base - n * plot / 3} x2="610" y2={base - n * plot / 3} stroke={track} /><text x="29" y={base - n * plot / 3 + 4} textAnchor="end" className="fill-qms-muted text-[11px]">{n * step}</text></g>)}
      {data.monthly.map((m, i) => {
        const x = left + slot * (i + .5), h1 = m.received / top * plot, h2 = m.resolvedOnTime / top * plot
        const description = label(m.month) + ': ' + m.received + ' recibidos; ' + (m.resolvedEvaluable ? m.resolvedOnTime + ' resueltos en plazo de ' + m.resolvedEvaluable + ' evaluables' : 'sin resoluciones evaluables')
        return <g key={m.month} tabIndex={0} role="img" aria-label={description} className="cursor-default focus:outline-none"
          onMouseEnter={() => setFocused(m.month)} onMouseLeave={() => setFocused(null)} onFocus={() => setFocused(m.month)} onBlur={() => setFocused(null)}>
          <title>{description}</title>
          <rect x={x - slot / 2 + 2} y="15" width={slot - 4} height="125" rx="5" fill={focused === m.month ? '#F0F4F8' : 'transparent'} />
          <rect x={x - bar - 1} y={base - h1} width={bar} height={h1} rx="3" fill={primary} />
          {m.resolvedEvaluable > 0 && <rect x={x + 1} y={base - h2} width={bar} height={h2} rx="3" fill={success} />}
          <text x={x} y="155" textAnchor="middle" className="fill-qms-muted text-[11px]">{label(m.month)}</text>
        </g>
      })}
    </svg>
    <p aria-live="polite" className="min-h-4 text-center text-[11px] text-qms-muted">{active ? label(active.month) + ' · ' + active.received + ' recibidos · ' + (active.resolvedEvaluable ? active.resolvedOnTime + '/' + active.resolvedEvaluable + ' en plazo' : 'Sin resoluciones evaluables') : data.resolution.total ? 'Recepción y resolución por su mes registrado' : 'Sin resoluciones evaluables en el período'}</p>
  </Card>
}
function Distribution({ data }: { data: DashboardMetrics }) {
  const total = data.received
  return <Card title="Distribución por estado" height={MAIN_HEIGHT}>
    <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:flex-nowrap">
      <svg viewBox="0 0 132 132" className="w-[132px] shrink-0" role="img" aria-label={total + ' solicitudes del período'}>
        <circle cx="66" cy="66" r="54" fill="none" stroke={track} strokeWidth="11" />
        {data.distribution.map((s, i) => {
          const p = total ? s.count / total * 100 : 0
          const at = total ? data.distribution.slice(0, i).reduce((sum, item) => sum + item.count, 0) / total * 100 : 0
          return p > 0 && <circle key={s.state} cx="66" cy="66" r="54" fill="none" stroke={colors[i]} strokeWidth="11" pathLength="100" strokeDasharray={p + ' ' + (100 - p)} strokeDashoffset={-at} transform="rotate(-90 66 66)"><title>{shortStates[i]}: {s.count} ({pct(p)})</title></circle>
        })}
        <text x="66" y="60" textAnchor="middle" className="fill-qms-dark text-[25px] font-semibold">{fmt.format(total)}</text>
        <text x="66" y="78" textAnchor="middle" className="fill-qms-muted text-[10px]">Solicitudes</text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.distribution.filter(s => s.state !== 'Otros' || s.count > 0).map(s => {
          const i = data.distribution.indexOf(s)
          return <li key={s.state} className="flex min-w-0 items-center gap-1.5 text-[11px] text-qms-muted"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} /><span className="flex-1">{shortStates[i]}</span><strong className="whitespace-nowrap font-medium tabular-nums text-qms-dark">{total ? pct(s.count / total * 100) : '—'}</strong></li>
        })}
      </ul>
    </div>
  </Card>
}
function Areas({ data }: { data: DashboardMetrics }) {
  const max = Math.max(1, ...data.areas.map(a => a.count))
  return <Card title="Top áreas afectadas" height={LOWER_HEIGHT}>
    <p className="mt-1 text-xs text-qms-muted">Solicitudes procedentes · Top 5</p>
    {data.areas.length ? <ul className="mt-3 space-y-2">{data.areas.map(a => <li key={a.area} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(64px,1fr)_auto] items-center gap-2 text-xs">
      <span className="truncate text-qms-dark" title={a.area}>{a.area}</span><svg role="img" aria-label={a.area + ': ' + a.count} viewBox="0 0 100 7" preserveAspectRatio="none" className="h-2 w-full"><rect width="100" height="7" rx="3.5" fill={track} /><rect width={a.count / max * 100} height="7" rx="3.5" fill={primary} /></svg><strong className="tabular-nums">{a.count}</strong>
    </li>)}</ul> : <p className="py-9 text-center text-sm text-qms-muted">Sin áreas registradas en solicitudes procedentes.</p>}
  </Card>
}
function Stage({ label, metric }: { label: string; metric: CountMetric }) {
  const p = percent(metric)
  return <div>
    <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium text-qms-dark">{label}</span><strong className="tabular-nums text-qms-dark">{pct(p)}</strong></div>
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="mt-1.5 h-2.5 w-full" role="img" aria-label={label + ': ' + pct(p) + ', meta 90 %'}>
      <rect width="100" height="8" rx="4" fill={track} />
      {p !== null && p > 0 && <rect width={p} height="8" rx="4" fill={p >= 90 ? success : warning} />}
      <line x1="90" x2="90" y1="0" y2="8" stroke="#596675" strokeWidth=".8" />
    </svg>
    <p className="mt-1 text-[11px] text-qms-muted">{metric.total ? metric.good + ' de ' + metric.total + ' ejecuciones evaluables' : 'Sin ejecuciones evaluables'}</p>
  </div>
}
export default function QuejasSummary({ data }: { data: DashboardMetrics }) {
  return <div data-dashboard-graphics className="space-y-3">
    <div className={KPI_GRID}>
      <RatioKpi title="Cumplimiento de plazos" metric={data.resolution} target detail={data.observed > data.resolution.total ? (data.observed - data.resolution.total) + ' sin plazo verificable' : 'Resoluciones evaluables'} />
      <Card title="Tiempo promedio de resolución" height={KPI_HEIGHT}><div className="mt-4 flex items-center justify-between gap-2"><div><p className="text-3xl font-semibold tabular-nums text-qms-dark">{data.average === null ? '—' : fmt.format(data.average)}</p><p className="mt-1 text-xs text-qms-muted">días calendario · {data.durationTotal} resoluciones</p></div><svg viewBox="0 0 48 48" className="size-12 shrink-0" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="none" stroke={track} strokeWidth="4" /><path d="M24 12V24L32 29" fill="none" stroke={primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></div></Card>
      <RatioKpi title="Procedencia" metric={data.procedure} detail="Sin felicitaciones ni pendientes" />
      <Card title="Expedientes activos" height={KPI_HEIGHT}><p className="mt-1 text-3xl font-semibold tabular-nums text-qms-dark">{fmt.format(data.active)}</p><ActiveBar data={data} /></Card>
    </div>
    <div className={MAIN_GRID}><Trend data={data} /><Distribution data={data} /></div>
    <div className={LOWER_GRID}><Areas data={data} /><Card title="Cumplimiento por etapa" height={LOWER_HEIGHT}><p className="mt-1 text-xs text-qms-muted">Meta 90 % · Plazos persistidos</p><div className="mt-3 space-y-3"><Stage label="Evaluación · 3 días" metric={data.evaluation} /><Stage label="Investigación · 15 días" metric={data.investigation} /></div></Card></div>
  </div>
}
