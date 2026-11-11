import type { Queja } from '@/lib/types'
import type { QuejaPlazoRun } from '@/lib/queries/useQuejaSeguimiento'
import { getQuejaDeadline } from '@/lib/utils/quejaDeadline'

export const CASE_FLOW = [
  { id: 'received', label: 'Recepción' }, { id: 'evaluation', label: 'Evaluación' },
  { id: 'investigation', label: 'Investigación' }, { id: 'quality_review', label: 'Revisión de GC' },
  { id: 'resolved', label: 'Resolución' }, { id: 'finished', label: 'Cierre' },
] as const
export const CASE_ACTIONS: Record<string, { step: number; title: string; detail: string; action: string }> = {
  Recibido: { step: 1, title: 'Evaluar procedencia', detail: 'Revisá la solicitud y asigná responsable si procede.', action: 'Tomar decisión' },
  'En Investigación': { step: 2, title: 'Investigar la queja', detail: 'Documentá los hallazgos, la resolución y su oficio.', action: 'Resolver' },
  'Pendiente de Revisión GC': { step: 3, title: 'Revisar la conclusión', detail: 'Aprobá la propuesta o devolvela para ajustes.', action: 'Aprobar y continuar' },
  Resuelto: { step: 4, title: 'Preparar informe para el cliente', detail: 'Editá el informe y elegí el documento que recibirá el cliente.', action: 'Respuesta al cliente' },
  Finalizado: { step: 5, title: 'Expediente finalizado', detail: 'El expediente conserva sus evidencias y seguimiento.', action: '' },
  'No Procede': { step: 5, title: 'No procedencia registrada', detail: 'Se conserva la justificación y el oficio explicativo.', action: '' },
}

export type CaseAudience = 'quality' | 'investigator'
export interface CaseRoleCycle {
  label: string
  detail: string
  steps: { id: string; label: string; current: boolean; completed: boolean }[]
}

/** Recorrido de lectura del expediente; no cambia estados, plazos ni permisos. */
export function getCaseProcessCycle(queja: Pick<Queja, 'estado'>): CaseRoleCycle {
  const steps = [
    { id: 'evaluation', label: 'Evaluación' },
    { id: 'investigation', label: 'Investigación' },
    { id: 'quality_review', label: 'Revisión de Calidad' },
    { id: 'finished', label: 'Cierre' },
  ]
  // No Procede cierra tras la evaluación; no atribuirle investigación o revisión.
  const visibleSteps = queja.estado === 'No Procede' ? [steps[0], steps[3]] : steps
  const positions: Record<string, number> = { Recibido: 0, 'En Investigación': 1, 'Pendiente de Revisión GC': 2, Resuelto: 3, Finalizado: 4, 'No Procede': 2 }
  const position = Object.hasOwn(positions, queja.estado) ? positions[queja.estado] : -1
  return { label: 'Etapas del expediente', detail: '', steps: visibleSteps.map((step, index) => ({ ...step, current: index === position, completed: position >= 0 && index < position })) }
}

/** Proyección de lectura por tarea; no representa el historial ni cambia el workflow. */
export function getCaseRoleCycle(queja: Pick<Queja, 'estado'>, audience: CaseAudience): CaseRoleCycle {
  const { estado } = queja
  if (audience === 'quality') {
    if (estado === 'No Procede') return {
      label: 'Gestión de Calidad', detail: 'No procedencia registrada; no requiere revisión de investigación.',
      steps: [
        { id: 'evaluation', label: 'Evaluación', current: false, completed: true },
        { id: 'finished', label: 'Cierre', current: false, completed: true },
      ],
    }
    const positions: Record<string, { current: number; completed: number }> = {
      Recibido: { current: 0, completed: 0 },
      // Esperar al responsable no equivale a tener una revisión de Calidad activa.
      'En Investigación': { current: -1, completed: 1 },
      'Pendiente de Revisión GC': { current: 1, completed: 1 },
      Resuelto: { current: 2, completed: 2 },
      Finalizado: { current: -1, completed: 3 },
    }
    const position = Object.hasOwn(positions, estado) ? positions[estado] : { current: -1, completed: 0 }
    return {
      label: 'Gestión de Calidad',
      detail: estado === 'En Investigación' ? 'Investigación a cargo del responsable.' : 'Progreso del estado actual.',
      steps: [
        { id: 'evaluation', label: 'Evaluación' },
        { id: 'quality_review', label: 'Revisión de Calidad' },
        { id: 'finished', label: 'Cierre' },
      ].map((step, index) => ({ ...step, current: index === position.current, completed: index < position.completed })),
    }
  }
  if (estado === 'No Procede') return {
    label: 'Tu trabajo', detail: 'La queja no procede y no requiere investigación.',
    steps: [{ id: 'not_investigated', label: 'Sin investigación', current: true, completed: false }],
  }
  const positions: Record<string, { current: number; completed: number }> = {
    Recibido: { current: 0, completed: 0 },
    'En Investigación': { current: 1, completed: 1 },
    'Pendiente de Revisión GC': { current: -1, completed: 3 },
    Resuelto: { current: -1, completed: 3 },
    Finalizado: { current: -1, completed: 3 },
  }
  const position = Object.hasOwn(positions, estado) ? positions[estado] : { current: -1, completed: 0 }
  return {
    label: 'Tu trabajo', detail: 'Calidad continúa después del envío.',
    steps: [
      { id: 'assignment', label: 'Asignación' },
      { id: 'investigation', label: 'Investigación' },
      { id: 'submitted', label: 'Propuesta enviada' },
    ].map((step, index) => ({ ...step, current: index === position.current, completed: index < position.completed })),
  }
}

const dates = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' })
const day = (value: string | number) => {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return null
  const parts = Object.fromEntries(dates.formatToParts(date).map(p => [p.type, p.value]))
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000
}
const obj = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** Presenta el snapshot; jamás calcula o cambia otro vencimiento a partir de prioridad. */
export function caseDeadline(queja: Queja, runs: QuejaPlazoRun[], now = Date.now()) {
  const result = getQuejaDeadline(queja, now)
  const run = runs.find(r => r.expires_at && result.vence && Date.parse(r.expires_at) === Date.parse(result.vence))
  const snapshot = obj(run?.snapshot), rule = obj(snapshot.rule), calendar = obj(snapshot.calendar)
  const duration = typeof rule.duration === 'number' && Number.isInteger(rule.duration) && rule.duration > 0 && rule.duration <= 3660 ? rule.duration : null
  const business = rule.day_type === 'business_days'
  const weekdays = Array.isArray(calendar.weekdays) && calendar.weekdays.length > 0 && calendar.weekdays.every(n => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 7) ? calendar.weekdays as number[] : null
  const holidayDates = Array.isArray(calendar.holidays) ? calendar.holidays.map(h => obj(h).date) : null
  const validHolidays = holidayDates !== null && holidayDates.every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d)
  const holidays = new Set(validHolidays ? holidayDates : [])
  const working = (d: number) => {
    const date = new Date(d * 86_400_000), weekday = date.getUTCDay() || 7
    return weekdays?.includes(weekday) && !holidays.has(date.toISOString().slice(0, 10))
  }
  const count = (from: number, to: number) => {
    // Calendarios corruptos/lapsos gigantes no deben bloquear el navegador.
    if (Math.abs(to - from) > 3660) return null
    const sign = to >= from ? 1 : -1; let total = 0
    for (let d = from + sign; sign > 0 ? d <= to : d >= to; d += sign) if (!business || working(d)) total += sign
    return total
  }
  const today = day(now), due = result.vence ? day(result.vence) : null, start = run ? day(run.started_at) : null
  let label = result.label, progress: number | null = null
  const calendarValid = rule.day_type === 'calendar_days' || (business && weekdays !== null && validHolidays)
  if (result.vence && today !== null && due !== null && run && calendarValid) {
    const remaining = result.vencido ? count(due, today) : count(today, due)
    if (remaining !== null && business) {
      const amount = Math.abs(remaining), unit = amount === 1 ? 'día hábil' : 'días hábiles'
      label = result.vencido ? due === today ? 'Venció hoy' : amount > 0 ? `Venció hace ${amount} ${unit}` : 'Vencido' : due === today ? 'Vence hoy' : `Vence en ${amount} ${unit}`
    }
    const elapsed = start === null ? null : count(start, Math.max(start, today))
    if (duration && duration > 0 && elapsed !== null) progress = Math.min(100, Math.max(0, elapsed / duration * 100))
  }
  return { ...result, label, progress, duration, business: business && calendarValid, stageTitle: run?.stage_id === 'quejas.investigation' ? 'Investigación' : run?.stage_id === 'quejas.evaluation' ? 'Evaluación inicial' : 'Plazo vigente' }
}
export function caseDate(value?: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', dateStyle: 'short', timeStyle: 'short' }) : '—'
}
