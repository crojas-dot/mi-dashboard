'use client'

import Link from 'next/link'
import { useId } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useQuejasEstadisticas, quejasEstadisticasKey } from '@/lib/queries/useQuejas'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useAuthStore } from '@/lib/store/auth-store'
import { tienePermiso } from '@/lib/permisos'
import DashboardLoading from './DashboardLoading'

const number = new Intl.NumberFormat('es-CR')

interface MetricProps {
  title: string
  value: number
  detail: string
  tone: 'primary' | 'info' | 'success' | 'warning'
  icon: string
}

function MetricCard({ title, value, detail, tone, icon }: MetricProps) {
  const mask = `url("/coreui-icons/${icon}.svg")`
  return (
    <article className={`coreui-metric-card coreui-metric-card--${tone}`}>
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="coreui-metric-title text-[13px] font-medium">{title}</p>
          <p className="mt-2.5 text-[31px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{number.format(value)}</p>
          <p className="mt-3 text-[12px] text-white/85">{detail}</p>
        </div>
        <span aria-hidden="true" className="coreui-metric-icon mt-0.5" style={{ maskImage: mask, WebkitMaskImage: mask }} />
      </div>
    </article>
  )
}

interface DonutProps {
  title: string
  value: number
  total: number
  labels: [string, string]
  color: string
  caption: string
}

function Donut({ title, value, total, labels, color, caption }: DonutProps) {
  const id = useId()
  const count = Math.max(0, Math.min(value, total))
  const percent = total > 0 ? count / total * 100 : 0
  const percentage = total > 0 ? `${number.format(Math.round(percent * 10) / 10)}%` : 'Sin datos'
  return (
    <figure className="coreui-analysis-figure min-w-0 px-6 py-5" aria-labelledby={id}>
      <figcaption id={id} className="text-[14px] font-semibold text-qms-dark">{title}</figcaption>
      <svg viewBox="0 0 200 200" role="img"
        aria-label={`${title}: ${labels[0]} ${count}, ${labels[1]} ${Math.max(0, total - count)}. ${percentage}.`}
        className="mx-auto my-2.5 block w-full max-w-[154px]">
        <circle cx="100" cy="100" r="76" fill="none" strokeWidth="18" className="stroke-gray-200" />
        {total > 0 && <circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" strokeWidth="18"
          pathLength="100" strokeDasharray={`${percent} ${100 - percent}`} transform="rotate(-90 100 100)" className={color} />}
        <text x="100" y="99" textAnchor="middle" dominantBaseline="middle" className="fill-qms-dark text-[31px] font-semibold">{percentage}</text>
        <text x="100" y="126" textAnchor="middle" className="fill-qms-muted text-[13px]">{total > 0 ? `${number.format(total)} evaluadas` : 'Sin registros'}</text>
      </svg>
      <dl className="space-y-2 text-[13px]">
        {[{ label: labels[0], value: count, dot: color }, { label: labels[1], value: Math.max(0, total - count), dot: 'text-gray-300' }].map(item => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <dt className="flex items-start gap-2 text-qms-muted"><span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full bg-current ${item.dot}`} />{item.label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-qms-dark">{number.format(item.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] leading-relaxed text-qms-muted">{caption}</p>
    </figure>
  )
}

export default function QuejasSummary() {
  const user = useAuthStore(s => s.user)
  const permisos = useAuthStore(s => s.permisos)
  if (!tienePermiso(permisos, 'quejas', false, user?.rol)) return null
  return <QuejasIndicators />
}

function QuejasIndicators() {
  const { data, isPending, error, refetch } = useQuejasEstadisticas()
  useRealtimeSubscription({ table: 'quejas', invalidateKeys: [quejasEstadisticasKey] })

  return (
    <section aria-labelledby="dashboard-quejas-title" className="mb-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="dashboard-quejas-title" className="text-[17px] font-semibold text-qms-dark">Indicadores de Quejas</h2>
          <p className="mt-0.5 text-[13px] text-qms-muted">Panorama de expedientes y cumplimiento</p>
        </div>
        <Link href="/quejas" className="flex items-center gap-1.5 rounded-md border border-qms-border bg-white px-3 py-2 text-[13px] font-semibold no-underline text-qms-primary hover:bg-qms-primary-soft">
          Abrir módulo <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {error ? (
        <div role="alert" className="coreui-panel p-5 text-sm">
          No se pudieron cargar los indicadores de Quejas.{' '}
          <button onClick={() => void refetch()} className="ui-button ui-button-link ui-button-sm underline">Reintentar</button>
        </div>
      ) : isPending || !data ? (
        <DashboardLoading label="Cargando indicadores de Quejas…" variant="summary" className="min-h-48" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard title="Quejas registradas" value={data.total} detail="Total de expedientes" tone="primary" icon="cil-speech" />
            <MetricCard title="Registradas este mes" value={data.mesActual} detail="Ingresadas en el mes actual" tone="info" icon="cil-inbox" />
            <MetricCard title="Resueltas a tiempo" value={data.resueltasATiempo} detail={`De ${number.format(data.resueltasTotal)} resoluciones`} tone="success" icon="cil-check-circle" />
            <MetricCard title="Quejas procedentes" value={data.procedentes} detail={`De ${number.format(data.totalConDecision)} con decisión`} tone="warning" icon="cil-task" />
          </div>

          <div className="coreui-panel mt-5">
            <div className="coreui-panel-head">
              <h2>Análisis de las quejas</h2>
              <p className="mt-1 text-[12px] text-qms-muted">Distribución basada en los registros del sistema</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3">
              <Donut title="Cumplimiento del plazo" value={data.resueltasATiempo} total={data.resueltasTotal}
                color="text-qms-success" labels={['Dentro del plazo', 'Fuera de plazo o sin fecha SLA']}
                caption="Se compara la fecha de cierre con el plazo de las quejas resueltas o finalizadas." />
              <Donut title="Procedencia" value={data.procedentes} total={data.totalConDecision}
                color="text-qms-primary" labels={['Procedentes', 'No procede']}
                caption="Se consideran los casos con decisión; los recibidos aún no evaluados quedan fuera." />
              <figure className="coreui-analysis-figure min-w-0 px-6 py-5" aria-labelledby="quejas-volumen-title">
                <figcaption id="quejas-volumen-title" className="text-[14px] font-semibold text-qms-dark">Volumen de expedientes</figcaption>
                <p className="mt-6 text-[36px] font-semibold leading-none tabular-nums tracking-tight text-qms-dark">{number.format(data.total)}</p>
                <p className="mt-2 text-[13px] text-qms-muted">Registros en total</p>
                <div className="mt-6 space-y-5">
                  {[{ label: 'Este mes', value: data.mesActual, tone: 'primary' },
                    { label: 'Otros meses', value: Math.max(0, data.total - data.mesActual), tone: 'success' }].map(item => (
                    <div key={item.label}>
                      <div className="mb-2 flex justify-between gap-3 text-[13px]">
                        <span className="text-qms-muted">{item.label}</span>
                        <strong className="tabular-nums text-qms-dark">{number.format(item.value)}</strong>
                      </div>
                      <div className="coreui-progress" role="img" aria-label={`${item.label}: ${item.value} de ${data.total} quejas`}>
                        <div data-color={item.tone} style={{ width: `${data.total > 0 ? Math.min(100, item.value / data.total * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-[12px] leading-relaxed text-qms-muted">{data.total === 0 ? 'Todavía no hay quejas registradas.' : 'Las barras reflejan la distribución del total histórico.'}</p>
              </figure>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
