'use client'

import { useId } from 'react'
import { useQuejasEstadisticas, quejasEstadisticasKey } from '@/lib/queries/useQuejas'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useAuthStore } from '@/lib/store/auth-store'
import { tienePermiso } from '@/lib/permisos'
import DashboardLoading from './DashboardLoading'

const number = new Intl.NumberFormat('es-CR')

interface DonutProps {
  title: string
  value: number
  total: number
  labels: [string, string]
  color: string
  caption: string
}

// SVG proporcional: usa los mismos conteos que la leyenda, sin cargar una librería adicional.
function Donut({ title, value, total, labels, color, caption }: DonutProps) {
  const id = useId()
  const count = Math.max(0, Math.min(value, total))
  const percent = total > 0 ? count / total * 100 : 0
  const percentage = total > 0 ? `${number.format(Math.round(percent * 10) / 10)}%` : 'Sin datos'
  return (
    <figure className="min-w-0 p-5" aria-labelledby={id}>
      <figcaption id={id} className="text-base font-semibold text-qms-dark">{title}</figcaption>
      <svg viewBox="0 0 200 200" role="img" aria-label={`${title}: ${labels[0]} ${count}, ${labels[1]} ${Math.max(0, total - count)}. ${percentage}.`}
        className="mx-auto my-4 block w-full max-w-[200px]">
        <circle cx="100" cy="100" r="76" fill="none" strokeWidth="20" className="stroke-gray-200" />
        {total > 0 && <circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" strokeWidth="20"
          pathLength="100" strokeDasharray={`${percent} ${100 - percent}`} transform="rotate(-90 100 100)" className={color} />}
        <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" className="fill-qms-dark text-3xl font-semibold">{percentage}</text>
        <text x="100" y="127" textAnchor="middle" className="fill-qms-muted text-sm">{total > 0 ? `${number.format(total)} evaluadas` : 'Sin registros evaluables'}</text>
      </svg>
      <dl className="space-y-2 text-sm">
        {[{ label: labels[0], value: count, dot: color }, { label: labels[1], value: Math.max(0, total - count), dot: 'text-gray-300' }].map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <dt className="flex items-start gap-2 text-qms-muted"><span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-current ${item.dot}`} />{item.label}</dt>
            <dd className="font-semibold tabular-nums text-qms-dark">{number.format(item.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-qms-muted">{caption}</p>
    </figure>
  )
}

export default function QuejasSummary() {
  const user = useAuthStore((s) => s.user)
  const permisos = useAuthStore((s) => s.permisos)
  if (!tienePermiso(permisos, 'quejas', false, user?.rol)) return null
  return <QuejasIndicators />
}

function QuejasIndicators() {
  const { data, isPending, error, refetch } = useQuejasEstadisticas()
  useRealtimeSubscription({ table: 'quejas', invalidateKeys: [quejasEstadisticasKey] })

  return (
    <section aria-labelledby="dashboard-quejas-title" className="mb-5 rounded-card border border-qms-border bg-qms-surface">
      <div className="border-b border-qms-border px-5 py-4">
        <h2 id="dashboard-quejas-title" className="text-lg font-semibold text-qms-dark">Indicadores de Quejas</h2>
        <p className="mt-1 text-sm text-qms-muted">Cumplimiento de plazos, procedencia y volumen registrado.</p>
      </div>
      {error ? (
        <div role="alert" className="p-5 text-sm">
          No se pudieron cargar los indicadores de Quejas.{' '}
          <button onClick={() => void refetch()} className="ui-button ui-button-link ui-button-sm underline">Reintentar</button>
        </div>
      ) : isPending || !data ? (
        <DashboardLoading label="Cargando indicadores de Quejas…" variant="summary" framed={false} />
      ) : (
        <div className="grid grid-cols-1 divide-y divide-qms-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <Donut title="Resolución dentro del plazo" value={data.resueltasATiempo} total={data.resueltasTotal}
            color="text-qms-success" labels={['Dentro del plazo', 'Fuera de plazo o sin fecha SLA']}
            caption="Resueltas o finalizadas con fecha de cierre. Se compara el cierre con el plazo establecido." />
          <Donut title="Procedencia de las quejas" value={data.procedentes} total={data.totalConDecision}
            color="text-qms-primary" labels={['Procedentes', 'No procede']}
            caption="Según los estados del registro. Las quejas en estado Recibido no se incluyen." />
          <figure className="min-w-0 p-5" aria-labelledby="quejas-volume-title">
            <figcaption id="quejas-volume-title" className="text-base font-semibold text-qms-dark">Volumen de quejas</figcaption>
            <p className="mt-6 text-4xl font-semibold tabular-nums text-qms-dark">{number.format(data.total)}</p>
            <p className="mt-1 text-sm text-qms-muted">registros en total</p>
            {/* Categorías excluyentes: mes actual y resto del historial; no inventar una serie mensual. */}
            <div className="mt-6 space-y-5">
              {[{ label: 'Este mes', value: data.mesActual, color: 'bg-qms-primary' },
                { label: 'Otros meses', value: Math.max(0, data.total - data.mesActual), color: 'bg-gray-400' }].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex justify-between gap-2 text-sm"><span>{item.label}</span><strong className="tabular-nums">{number.format(item.value)}</strong></div>
                  <div role="img" aria-label={`${item.label}: ${item.value} de ${data.total} quejas`} className="h-5 overflow-hidden rounded-sm bg-gray-100">
                    <div className={`h-full ${item.color}`} style={{ width: `${data.total > 0 ? Math.min(100, item.value / data.total * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-qms-muted">{data.total === 0 ? 'Todavía no hay quejas registradas.' : 'Cada barra representa su parte del total histórico.'}</p>
          </figure>
        </div>
      )}
    </section>
  )
}
