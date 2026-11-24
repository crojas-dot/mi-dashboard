'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { tienePermiso } from '@/lib/permisos'
import { MODULOS } from '@/lib/constants/modulos'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { dashboardQuejasKey, dashboardQuejasOptions, useDashboardQuejas } from '@/lib/queries/useDashboard'
import { dashboardPeriod, type PeriodChoice } from '@/lib/utils/dashboardQuejas'
import DeferredMount from '@/components/ui/DeferredMount'
import PageHeader from '@/components/ui/PageHeader'
import DashboardLoading from '@/components/dashboard/DashboardLoading'
import QuejasSummary from '@/components/dashboard/QuejasSummary'
import { logger } from '@/lib/utils/logger'

const tabs = ['quejas', 'sacp', 'documentos', 'riesgos', 'auditorias', 'revision', 'procesos'] as const
type Tab = typeof tabs[number]
const printDate = () => new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', dateStyle: 'long', timeStyle: 'short', hourCycle: 'h12' })

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('quejas')
  const [choice, setChoice] = useState<PeriodChoice>('year')
  const [today] = useState(() => new Date())
  const [generated, setGenerated] = useState(printDate)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const user = useAuthStore(s => s.user)
  const permisos = useAuthStore(s => s.permisos)
  const client = useQueryClient()
  const allowed = tienePermiso(permisos, 'quejas', false, user?.rol)
  const active = tab === 'quejas' && allowed
  const period = dashboardPeriod(choice, today)
  const { data, isPending, error, refetch } = useDashboardQuejas(period, active)
  const cachedYear = client.getQueryData<NonNullable<typeof data>>(dashboardQuejasOptions(dashboardPeriod('year', today)).queryKey)
  const hasPrevious = data?.hasPrevious ?? cachedYear?.hasPrevious ?? choice === 'previous'
  useRealtimeSubscription({ table: 'quejas', enabled: active, invalidateKeys: [dashboardQuejasKey] })
  useEffect(() => {
    if (error) logger.error('No se pudieron cargar indicadores ejecutivos', { module: 'dashboard', action: 'quejas' }, error)
  }, [error])
  useEffect(() => {
    const beforePrint = () => flushSync(() => setGenerated(printDate()))
    window.addEventListener('beforeprint', beforePrint)
    return () => window.removeEventListener('beforeprint', beforePrint)
  }, [])

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    setTab(tabs[next])
    buttons.current[next]?.focus()
  }

  return <div data-dashboard-print className="min-w-0">
    <PageHeader title="Dashboard · Indicadores del SGC" compact={false}>
      <div data-dashboard-controls className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="dashboard-period">Período</label>
        <select id="dashboard-period" className="ui-input min-h-10 max-w-full px-3 text-sm" value={choice} onChange={event => setChoice(event.target.value as PeriodChoice)}>
          <option value="year">Año actual ({period.year})</option>
          <option value="six">Últimos 6 meses</option>
          {(hasPrevious || choice === 'previous') && <option value="previous">Año anterior ({period.year - 1})</option>}
        </select>
        <button type="button" className="ui-button ui-button-outline ui-button-sm min-h-10 gap-2" disabled={!active || !data || !!error} onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" />Imprimir / PDF</button>
      </div>
    </PageHeader>
    <p data-dashboard-print-meta className="hidden print:block text-sm text-qms-muted">Módulo: {MODULOS[tab].label} · Período: {period.label} · Generado: {generated}</p>
    <div data-dashboard-tabs role="tablist" aria-label="Módulos del SGC" className="mb-3 flex gap-1 overflow-x-auto border-b border-qms-border">
      {tabs.map((id, index) => <button key={id} ref={node => { buttons.current[index] = node }} id={'dashboard-tab-' + id} role="tab" type="button"
        aria-selected={tab === id} aria-controls={'dashboard-panel-' + id} tabIndex={tab === id ? 0 : -1}
        className={'min-h-10 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-medium ' + (tab === id ? 'border-qms-primary text-qms-primary' : 'border-transparent text-qms-muted hover:text-qms-dark')}
        onClick={() => setTab(id)} onKeyDown={event => moveTab(event, index)}>{MODULOS[id].label}</button>)}
    </div>
    {tabs.map(id => <DeferredMount key={id} active={tab === id}>
      <section role="tabpanel" id={'dashboard-panel-' + id} aria-labelledby={'dashboard-tab-' + id} hidden={tab !== id}>
        {id === 'quejas' ? !allowed ? <div className="rounded-card border border-qms-border bg-qms-surface p-8 text-center text-sm text-qms-muted">No dispone de permiso para consultar los indicadores de Quejas.</div>
          : error ? <div role="alert" className="rounded-card border border-qms-border bg-qms-surface p-6 text-sm">No se pudieron cargar los indicadores. <button type="button" className="font-medium text-qms-primary underline" onClick={() => void refetch()}>Reintentar</button></div>
          : isPending || !data ? <DashboardLoading label="Cargando indicadores de Quejas…" variant="executive" />
          : <QuejasSummary data={data.metrics} />
          : <div className="flex min-h-64 flex-col items-center justify-center rounded-card border border-qms-border bg-qms-surface p-8 text-center">
            <svg viewBox="0 0 48 48" className="mb-4 size-12 text-qms-muted" aria-hidden="true"><path d="M8 39V9M8 39H41" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><rect x="14" y="24" width="6" height="15" rx="2" fill="currentColor" opacity=".35" /><rect x="24" y="16" width="6" height="23" rx="2" fill="currentColor" opacity=".45" /><rect x="34" y="10" width="6" height="29" rx="2" fill="currentColor" opacity=".55" /></svg>
            <h2 className="font-semibold text-qms-dark">{MODULOS[id].label}</h2><p className="mt-1 text-sm text-qms-muted">Módulo en preparación · Sin indicadores activos</p>
          </div>}
      </section>
    </DeferredMount>)}
  </div>
}
