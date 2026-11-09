export interface QmsHoliday { date: string; description: string }
export interface QmsCalendar {
  id: number
  weekdays: number[]
  holidays: QmsHoliday[]
  timezone: string
  created_at: string
}
export interface QmsCalendarDraft { weekdays: number[]; holidays: QmsHoliday[]; reason: string }

export const QMS_WEEKDAYS = [
  { value: 1, label: 'Lunes' }, { value: 2, label: 'Martes' }, { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' }, { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' }, { value: 7, label: 'Domingo' },
] as const
export const MAX_QMS_HOLIDAYS = 1000
export const MAX_QMS_HOLIDAY_DESCRIPTION = 200
export const MAX_QMS_CALENDAR_REASON = 500

/** Una fecha civil no se convierte a Date/UTC: se conserva el día elegido en Costa Rica. */
export function esFechaCalendarioQms(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

function validWeekdays(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 7
    && value.every(day => Number.isInteger(day) && day >= 1 && day <= 7)
    && new Set(value).size === value.length
}

export function esVersionCalendarioQms(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function validarFeriadosCalendarioQms(holidays: QmsHoliday[]): string | null {
  if (!Array.isArray(holidays) || holidays.length > MAX_QMS_HOLIDAYS)
    return `El calendario admite hasta ${MAX_QMS_HOLIDAYS} feriados.`
  const dates = new Set<string>()
  for (const holiday of holidays) {
    if (!holiday || !esFechaCalendarioQms(holiday.date)) return 'Cada feriado necesita una fecha válida.'
    if (dates.has(holiday.date)) return 'Hay fechas de feriado repetidas.'
    dates.add(holiday.date)
    if (typeof holiday.description !== 'string' || !holiday.description.trim()
      || holiday.description.trim().length > MAX_QMS_HOLIDAY_DESCRIPTION
      || /[\u0000-\u001f\u007f]/.test(holiday.description))
      return `Cada feriado necesita una descripción de hasta ${MAX_QMS_HOLIDAY_DESCRIPTION} caracteres.`
  }
  return null
}

export function validarCalendarioQms(draft: QmsCalendarDraft): string | null {
  if (!validWeekdays(draft.weekdays)) return 'Seleccioná al menos un día laboral, sin repetir días.'
  const holidayError = validarFeriadosCalendarioQms(draft.holidays)
  if (holidayError) return holidayError
  if (typeof draft.reason !== 'string' || !draft.reason.trim() || draft.reason.trim().length > MAX_QMS_CALENDAR_REASON
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(draft.reason))
    return `Indicá el motivo del cambio, hasta ${MAX_QMS_CALENDAR_REASON} caracteres.`
  return null
}

export function normalizarCalendarioQms(draft: QmsCalendarDraft): QmsCalendarDraft {
  return {
    weekdays: [...draft.weekdays].sort((a, b) => a - b),
    holidays: draft.holidays.map(item => ({ date: item.date, description: item.description.trim() }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    reason: draft.reason.trim(),
  }
}

export function calendarioQmsCambio(calendar: QmsCalendar, draft: QmsCalendarDraft): boolean {
  const previous = normalizarCalendarioQms({ ...calendar, reason: '' })
  const next = normalizarCalendarioQms(draft)
  return JSON.stringify([previous.weekdays, previous.holidays]) !== JSON.stringify([next.weekdays, next.holidays])
}

/** Se omiten autores y otros campos de DB; el editor solo necesita la versión y su calendario. */
export function parseQmsCalendar(value: unknown): QmsCalendar {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Calendario no disponible.')
  const row = value as Record<string, unknown>
  const holidays = row.holidays
  if (!esVersionCalendarioQms(row.id) || !validWeekdays(row.weekdays) || !Array.isArray(holidays)
    || holidays.length > MAX_QMS_HOLIDAYS || holidays.some(item => !item || typeof item !== 'object'
      || !esFechaCalendarioQms(item.date) || typeof item.description !== 'string' || !item.description.trim())
    || new Set(holidays.map(item => item.date)).size !== holidays.length
    || typeof row.timezone !== 'string' || !row.timezone || typeof row.created_at !== 'string'
    || !Number.isFinite(Date.parse(row.created_at))) throw new Error('Calendario no disponible.')
  return {
    id: row.id, weekdays: [...row.weekdays],
    holidays: holidays.map(item => ({ date: item.date, description: item.description })),
    timezone: row.timezone, created_at: row.created_at,
  }
}
