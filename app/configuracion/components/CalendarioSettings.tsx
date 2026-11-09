'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Plus, Save, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import ErrorState from '@/components/ui/ErrorState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import { useQmsCalendar, qmsCalendarKey } from '@/lib/queries/useQmsCalendar'
import { publicarCalendarioQms } from '@/lib/services/qmsCalendarService'
import { useAuthStore } from '@/lib/store/auth-store'
import { isLogoutPending } from '@/lib/authLogoutIntent'
import { getUserError } from '@/lib/errors/userError'
import { QMS_WEEKDAYS, MAX_QMS_HOLIDAYS, MAX_QMS_HOLIDAY_DESCRIPTION, MAX_QMS_CALENDAR_REASON, calendarioQmsCambio, validarCalendarioQms, validarFeriadosCalendarioQms, type QmsCalendar, type QmsCalendarDraft } from '@/lib/utils/qmsCalendar'

type Editor = { base: QmsCalendar; draft: QmsCalendarDraft }
const draftFrom = (calendar: QmsCalendar): QmsCalendarDraft => ({ weekdays: [...calendar.weekdays], holidays: calendar.holidays.map(holiday => ({ ...holiday })), reason: '' })
const displayDate = (date: string) => date.split('-').reverse().join('/')

/** La versión se captura al abrir el editor: una lectura nueva nunca sustituye
 * el borrador ni cambia la revisión con la que se publicará el calendario. */
export default function CalendarioSettings({ active }: { active: boolean }) {
  const user = useAuthStore(state => state.user)
  const initialized = useAuthStore(state => state.initialized)
  const signingOut = useAuthStore(state => state.signingOut)
  const view = useAuthStore(state => state.vistaActiva)
  const allowed = initialized && user?.rol === 'admin' && !signingOut
  const query = useQmsCalendar(active && allowed)
  const client = useQueryClient()
  const scope = useEntityRequestGuard(active && allowed ? 'qms-calendar' : null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayDescription, setHolidayDescription] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [conflict, setConflict] = useState(false)
  const [confirmReload, setConfirmReload] = useState(false)
  const [busy, setBusy] = useState(false)
  const [savedVersion, setSavedVersion] = useState<number | null>(null)
  const lock = useRef<symbol | null>(null)
  const editorRef = useRef(editor)
  const mounted = useRef(false)
  useLayoutEffect(() => { editorRef.current = editor }, [editor])
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const sameIdentity = () => {
    const live = useAuthStore.getState()
    return live.initialized && !live.signingOut && !isLogoutPending() && live.user?.id === user?.id && live.user?.rol === 'admin' && live.vistaActiva === view
  }
  const updateDraft = (draft: QmsCalendarDraft) => {
    if (!editor || lock.current) return
    setEditor({ ...editor, draft }); setError(''); setStatus('')
  }
  const beginEditing = () => {
    if (!query.data || lock.current || !sameIdentity()) return
    setEditor({ base: query.data, draft: draftFrom(query.data) })
    setHolidayDate(''); setHolidayDescription(''); setError(''); setStatus(''); setConflict(false)
  }
  const addHoliday = () => {
    if (!editor || lock.current) return
    const holidays = [...editor.draft.holidays, { date: holidayDate, description: holidayDescription.trim() }]
    const invalid = validarFeriadosCalendarioQms(holidays)
    if (invalid) { setError(invalid); return }
    updateDraft({ ...editor.draft, holidays: holidays.sort((a, b) => a.date.localeCompare(b.date)) })
    setHolidayDate(''); setHolidayDescription('')
  }

  const execute = async (reload: boolean) => {
    if (lock.current || !sameIdentity() || !active) return
    const captured = editorRef.current
    if (!reload) {
      if (!captured || !calendarioQmsCambio(captured.base, captured.draft)) return
      if (holidayDate || holidayDescription.trim()) { setError('Añadí o limpiá el feriado pendiente antes de guardar.'); return }
      const invalid = validarCalendarioQms(captured.draft)
      if (invalid) { setError(invalid); return }
      if (conflict) return
    }
    const operation = scope.start('calendar')
    if (!operation) return
    const token = Symbol('calendar')
    lock.current = token; setBusy(true); setError(''); setStatus('')
    const isContextCurrent = scope.captureContext()
    const sameVisit = () => operation.isCurrent() && isContextCurrent() && sameIdentity()
    const current = () => sameVisit() && editorRef.current === captured
    let committed = false
    try {
      if (reload) {
        const result = await query.refetch({ throwOnError: true })
        if (!current()) return
        if (!result.data) { setError('No hay un calendario vigente disponible. Tu borrador se conserva.'); return }
        if (captured) setEditor({ base: result.data, draft: draftFrom(result.data) })
        setHolidayDate(''); setHolidayDescription(''); setConflict(false); setConfirmReload(false); setSavedVersion(null)
        setStatus(captured ? 'Versión vigente cargada. Revisá los cambios antes de guardar.' : 'Calendario actualizado.')
      } else if (captured) {
        const version = await publicarCalendarioQms(captured.base.id, captured.draft)
        committed = true
        if (current()) {
          setEditor(null); setSavedVersion(version); setConflict(false)
          setStatus('Calendario guardado. Los vencimientos de etapas abiertas se conservan.')
        }
        // La escritura confirmada invalida su ámbito de origen aunque se haya
        // ocultado esta sección. Una respuesta vieja no modifica otra visita.
        if (isContextCurrent() && sameIdentity()) await client.invalidateQueries({ queryKey: qmsCalendarKey, exact: true, refetchType: 'none' })
        if (!sameVisit()) return
        try { await query.refetch({ throwOnError: true }) }
        catch {
          if (operation.isCurrent() && isContextCurrent() && sameIdentity()) setError('El calendario se guardó, pero no se pudo actualizar la vista. Reintentá la actualización antes de editar de nuevo.')
        }
      }
    } catch (cause) {
      if (!(committed ? sameVisit() : current())) return
      if (committed) setError('El calendario se guardó, pero no se pudo actualizar la vista. Reintentá la actualización antes de editar de nuevo.')
      else if (getUserError(cause).code === '40001') { setConflict(true); setError('El calendario cambió mientras editabas. Tu borrador se conserva; cargá la versión vigente para revisarla.') }
      else setError(getUserError(cause, reload ? 'No se pudo cargar la versión vigente. Tu borrador se conserva.' : 'No se pudo guardar el calendario. Tu borrador se conserva.').message)
    } finally {
      if (lock.current === token) { lock.current = null; if (mounted.current) setBusy(false) }
      operation.finish()
    }
  }

  if (!allowed) return null
  if (query.isPending && !editor) return <LoadingSkeleton variant="form" label="Cargando calendario laboral…" />
  if (query.error && !query.data && !editor) return <ErrorState message="No se pudo cargar el calendario laboral." onRetry={() => void query.refetch()} />
  const calendar = editor?.base ?? query.data
  if (!calendar) return <p className="ui-panel p-5 text-sm text-qms-muted">No hay un calendario laboral publicado. Contactá al administrador técnico para revisar su configuración.</p>
  const selected = editor?.draft ?? draftFrom(calendar)
  const changed = !!editor && calendarioQmsCambio(editor.base, editor.draft)
  const newerVersion = !!editor && !!query.data && editor.base.id !== query.data.id
  const awaitingRefresh = savedVersion !== null && (!query.data || query.data.id < savedVersion)

  return <div className="min-w-0 space-y-5">
    <section className="ui-panel p-5" aria-label="Plazos de Quejas">
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm"><p><span className="font-medium">Evaluación:</span> 3 días hábiles</p><p><span className="font-medium">Investigación:</span> 15 días hábiles</p></div>
      <p className="mt-2 text-sm text-qms-muted">El calendario laboral es compartido por las etapas del sistema. Aquí se conservan los plazos y recordatorios de Quejas.</p>
    </section>
    <section className="ui-panel min-w-0" aria-labelledby="qms-calendar-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-qms-border px-5 py-4">
        <div><h3 id="qms-calendar-title" className="font-medium">Calendario laboral</h3><p className="mt-1 text-sm text-qms-muted">Zona del calendario: {calendar.timezone} · Versión {calendar.id}</p></div>
        {!editor && <Button size="sm" variant="secondary" disabled={busy || awaitingRefresh} onClick={beginEditing}><CalendarDays className="h-4 w-4" aria-hidden="true" /> Editar calendario</Button>}
      </div>
      <form className="min-w-0 space-y-5 p-5" onSubmit={event => { event.preventDefault(); void execute(false) }}>
        <p id="qms-calendar-effect" className="text-sm text-qms-muted">Se aplicará a las etapas que comiencen después de guardar; los vencimientos de etapas ya abiertas se conservan.</p>
        {/* El mínimo nativo de fieldset es min-content; debe poder encogerse
            también cuando una descripción válida contiene una palabra larga. */}
        <fieldset disabled={!editor || busy} className="min-w-0 space-y-5" aria-describedby="qms-calendar-effect">
          <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium">Días laborables</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{QMS_WEEKDAYS.map(day => <label key={day.value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm has-disabled:cursor-default"><input type="checkbox" className="h-4 w-4 accent-qms-primary" checked={selected.weekdays.includes(day.value)} onChange={event => updateDraft({ ...selected, weekdays: event.target.checked ? [...selected.weekdays, day.value].sort((a, b) => a - b) : selected.weekdays.filter(value => value !== day.value) })} />{day.label}</label>)}</div></fieldset>
          <div className="min-w-0">
            <h4 className="text-sm font-medium">Feriados y días no laborables ({selected.holidays.length})</h4>
            <p className="mt-1 text-sm text-qms-muted">Registrá únicamente las fechas confirmadas por la institución. No se añaden feriados automáticamente.</p>
            {editor && <div className="mt-4 grid min-w-0 items-end gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
              <Field id="qms-holiday-date" label="Fecha"><Input id="qms-holiday-date" type="date" value={holidayDate} onChange={event => { setHolidayDate(event.target.value); setError('') }} /></Field>
              <Field id="qms-holiday-description" label="Descripción"><Input id="qms-holiday-description" maxLength={MAX_QMS_HOLIDAY_DESCRIPTION} value={holidayDescription} onChange={event => { setHolidayDescription(event.target.value); setError('') }} placeholder="Ej.: cierre institucional" /></Field>
              <Button variant="secondary" disabled={!holidayDate || !holidayDescription.trim() || selected.holidays.length >= MAX_QMS_HOLIDAYS} onClick={addHoliday}><Plus className="h-4 w-4" aria-hidden="true" /> Añadir</Button>
            </div>}
            {selected.holidays.length ? <ul className="mt-4 max-h-72 min-w-0 max-w-full divide-y divide-qms-border overflow-y-auto overscroll-contain rounded-card border border-qms-border" aria-label="Fechas no laborables">{[...selected.holidays].sort((a, b) => a.date.localeCompare(b.date)).map(holiday => <li key={holiday.date} className="flex min-w-0 items-center justify-between gap-3 px-3 py-2"><div className="min-w-0 flex-1 text-sm"><span className="mr-3 tabular-nums whitespace-nowrap">{displayDate(holiday.date)}</span><span className="text-qms-muted [overflow-wrap:anywhere]">{holiday.description}</span></div>{editor && <Button size="icon" variant="ghost" className="shrink-0" aria-label={`Quitar ${holiday.description}, ${displayDate(holiday.date)}`} onClick={() => updateDraft({ ...selected, holidays: selected.holidays.filter(item => item.date !== holiday.date) })}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}</li>)}</ul> : <p className="mt-3 rounded-card bg-qms-hover-bg p-3 text-sm text-qms-muted">No hay feriados registrados.</p>}
            {editor && <p className="mt-2 text-xs text-qms-muted">Hasta {MAX_QMS_HOLIDAYS} fechas por versión.</p>}
          </div>
          {editor && <Field id="qms-calendar-reason" label="Motivo del cambio" hint="Dejá constancia de por qué se modifica el calendario."><Textarea id="qms-calendar-reason" required rows={2} maxLength={MAX_QMS_CALENDAR_REASON} aria-describedby="qms-calendar-reason-hint" value={selected.reason} onChange={event => updateDraft({ ...selected, reason: event.target.value })} /></Field>}
        </fieldset>
        {(newerVersion || conflict) && <p role="status" className="rounded-card bg-qms-primary-soft p-3 text-sm text-qms-primary">Hay una versión más reciente. El borrador sigue basado en la versión {editor?.base.id}; no se reemplaza automáticamente.</p>}
        {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
        {status && <p role="status" className="text-sm text-qms-success">{status}</p>}
        {editor ? <div className="flex flex-wrap justify-end gap-2">
          {(newerVersion || conflict) && <Button variant="secondary" disabled={busy} onClick={() => setConfirmReload(true)}>Cargar versión vigente</Button>}
          <Button variant="ghost" disabled={busy} onClick={() => { setEditor(null); setError(''); setConflict(false); setHolidayDate(''); setHolidayDescription('') }}>Cancelar edición</Button>
          <Button type="submit" loading={busy} disabled={!changed || conflict}><Save className="h-4 w-4" aria-hidden="true" /> Guardar calendario</Button>
        </div> : awaitingRefresh && <div className="flex justify-end"><Button variant="secondary" loading={busy} onClick={() => void execute(true)}>Reintentar actualización</Button></div>}
      </form>
    </section>
    <ConfirmDialog open={confirmReload} title="Cargar versión vigente" message="Se descartará este borrador para cargar el calendario publicado. Revisá la versión vigente antes de volver a editar." confirmLabel="Descartar borrador y cargar" loading={busy} onCancel={() => setConfirmReload(false)} onConfirm={() => void execute(true)} />
  </div>
}
