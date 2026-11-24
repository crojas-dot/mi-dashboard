import { tipoVisible } from '@/lib/constants/quejas'

export type PeriodChoice = 'year' | 'six' | 'previous'
export interface DashboardPeriod { start: string; end: string; months: string[]; label: string; year: number }
export interface DashboardCase { id: string; fecha: string; tipo?: string | null; categoria?: string | null; estado: string; area_afectada: string | null }
export interface DashboardRun { id: string; case_id: string; stage_id: string; started_at: string; expires_at: string | null; ended_at: string | null; end_event: string | null; provenance: string }
export interface DashboardEvent { id: number; case_id: string; occurred_at: string }
export interface CountMetric { good: number; total: number }
export const OPEN_STATES = ['Recibido', 'En Investigación', 'Pendiente de Revisión GC', 'Resuelto'] as const
export const STATES = [...OPEN_STATES, 'Finalizado', 'No Procede', 'Otros'] as const
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' })
const monthName = new Intl.DateTimeFormat('es-CR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
export function civilDate(value: string | Date) {
  const parts = Object.fromEntries(clock.formatToParts(new Date(value)).map(p => [p.type, p.value]))
  return parts.year + '-' + parts.month + '-' + parts.day
}
function monthAt(index: number) {
  return new Date(Date.UTC(Math.floor(index / 12), index % 12, 1)).toISOString().slice(0, 7)
}
export function dashboardPeriod(choice: PeriodChoice, now = new Date()): DashboardPeriod {
  const [y, m] = civilDate(now).split('-').map(Number)
  const current = y * 12 + m - 1
  const first = choice === 'six' ? current - 5 : (y - (choice === 'previous' ? 1 : 0)) * 12
  const last = choice === 'previous' ? y * 12 - 1 : current
  const months = Array.from({ length: last - first + 1 }, (_, i) => monthAt(first + i))
  const label = choice === 'six' ? monthName.format(new Date(months[0] + '-01T00:00:00Z')) + ' – ' + monthName.format(new Date(months[months.length - 1] + '-01T00:00:00Z')) : String(choice === 'previous' ? y - 1 : y)
  return { start: months[0] + '-01T00:00:00-06:00', end: monthAt(last + 1) + '-01T00:00:00-06:00', months, label, year: y }
}
const inPeriod = (value: string, p: DashboardPeriod) => Date.parse(value) >= Date.parse(p.start) && Date.parse(value) < Date.parse(p.end)
const validRun = (r: DashboardRun) => r.provenance === 'configured' && !!r.ended_at && !!r.expires_at &&
  Number.isFinite(Date.parse(r.started_at)) && Number.isFinite(Date.parse(r.expires_at)) && Date.parse(r.ended_at) >= Date.parse(r.started_at)
const evaluable = (r: DashboardRun) => validRun(r) && (
  r.stage_id === 'quejas.evaluation' && ['En Investigación', 'No Procede'].includes(r.end_event ?? '') ||
  r.stage_id === 'quejas.investigation' && ['Pendiente de Revisión GC', 'Resuelto'].includes(r.end_event ?? ''))
const onTime = (r: DashboardRun) => Date.parse(r.ended_at!) <= Date.parse(r.expires_at!)
const eligibleDecision = (q: DashboardCase) => tipoVisible(q) !== 'Felicitación' && tipoVisible(q) !== '—' &&
  [...OPEN_STATES.slice(1), 'Finalizado', 'No Procede'].includes(q.estado)
const proceeds = (q: DashboardCase) => eligibleDecision(q) && q.estado !== 'No Procede'

export function summarizeDashboard(period: DashboardPeriod, cases: DashboardCase[], events: DashboardEvent[], runs: DashboardRun[]) {
  const cohort = cases.filter(q => inPeriod(q.fecha, period))
  const byId = new Map(cases.map(q => [q.id, q]))
  const monthly = period.months.map(month => ({ month, received: 0, resolvedOnTime: 0, resolvedEvaluable: 0 }))
  const byMonth = new Map(monthly.map(m => [m.month, m]))
  const distribution = STATES.map(state => ({ state, count: cohort.filter(q => state === 'Otros' ? !(STATES.slice(0, -1) as readonly string[]).includes(q.estado) : q.estado === state).length }))
  const decisions = cohort.filter(eligibleDecision)
  const areas = new Map<string, number>()
  for (const q of cohort) {
    const m = byMonth.get(civilDate(q.fecha).slice(0, 7)); if (m) m.received++
    if (proceeds(q) && q.area_afectada?.trim()) {
      const area = q.area_afectada.trim(); areas.set(area, (areas.get(area) ?? 0) + 1)
    }
  }
  const runsByCase = new Map<string, DashboardRun[]>()
  for (const r of runs) { const group = runsByCase.get(r.case_id) ?? []; group.push(r); runsByCase.set(r.case_id, group) }
  let resolutionTotal = 0, resolutionGood = 0, sumDays = 0, durationTotal = 0, observed = 0
  const consumed = new Set<string>()
  // Una resolución observada puede cerrar un caso ingresado en otro período.
  // Una ejecución de investigación no puede acreditar dos resoluciones.
  for (const event of [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || a.id - b.id)) {
    if (!inPeriod(event.occurred_at, period)) continue
    const q = byId.get(event.case_id); if (!q) continue
    observed++
    const elapsed = Date.parse(event.occurred_at) - Date.parse(q.fecha)
    if (Number.isFinite(elapsed) && elapsed >= 0) { sumDays += elapsed / 86_400_000; durationTotal++ }
    const matching = (runsByCase.get(event.case_id) ?? [])
      .filter(r => r.stage_id === 'quejas.investigation' && !!r.ended_at && Date.parse(r.ended_at) <= Date.parse(event.occurred_at))
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at) || a.id.localeCompare(b.id))[0]
    if (!matching || consumed.has(matching.id) || !evaluable(matching)) continue
    consumed.add(matching.id)
    resolutionTotal++
    const m = byMonth.get(civilDate(event.occurred_at).slice(0, 7)); if (m) m.resolvedEvaluable++
    if (Date.parse(event.occurred_at) <= Date.parse(matching.expires_at!)) {
      resolutionGood++; if (m) m.resolvedOnTime++
    }
  }
  const stageMetric = (stage: string): CountMetric => {
    const completed = runs.filter(r => r.stage_id === stage && r.ended_at && inPeriod(r.ended_at, period) && evaluable(r))
    return { good: completed.filter(onTime).length, total: completed.length }
  }
  return {
    received: cohort.length, distribution, monthly,
    active: distribution.slice(0, OPEN_STATES.length).reduce((sum, s) => sum + s.count, 0),
    procedure: { good: decisions.filter(proceeds).length, total: decisions.length },
    resolution: { good: resolutionGood, total: resolutionTotal }, observed,
    average: durationTotal ? sumDays / durationTotal : null, durationTotal,
    evaluation: stageMetric('quejas.evaluation'), investigation: stageMetric('quejas.investigation'),
    areas: [...areas].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area, 'es-CR')).slice(0, 5),
  }
}
export type DashboardMetrics = ReturnType<typeof summarizeDashboard>
