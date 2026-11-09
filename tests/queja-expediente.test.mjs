import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, fakeDatabase } from './load-module.mjs'

const { caseDeadline } = loadModule('app/quejas/components/quejaExpedienteModel.ts')
const due = '2026-10-14T23:00:00-06:00'
const queja = { estado: 'Recibido', plazo_vence: due, plazo_etapa: 'quejas.evaluation' }
const run = { id: 'run', stage_id: 'quejas.evaluation', started_at: '2026-10-09T12:00:00-06:00', expires_at: due, snapshot: { rule: { day_type: 'business_days', duration: 3 }, calendar: { weekdays: [1, 2, 3, 4, 5], holidays: [] } } }
const at = date => Date.parse(date + 'T12:00:00-06:00')

test('el plazo visible cuenta el calendario persistido y conserva el vencimiento', () => {
  const result = caseDeadline(queja, [run], at('2026-10-09'))
  assert.equal(result.label, 'Vence en 3 días hábiles')
  assert.equal(result.vence, due)
  assert.equal(result.progress, 0)
  assert.ok(Math.abs(caseDeadline(queja, [run], at('2026-10-12')).progress - 100 / 3) < 0.00001)
})
test('sábado y domingo no consumen días del snapshot hábil', () => {
  for (const date of ['2026-10-10', '2026-10-11']) {
    const result = caseDeadline(queja, [run], at(date))
    assert.equal(result.label, 'Vence en 3 días hábiles')
    assert.equal(result.progress, 0)
  }
})
test('feriados y semana particular proceden del snapshot, sin calendario actual global', () => {
  const special = { ...run, snapshot: { rule: { day_type: 'business_days', duration: 2 }, calendar: { weekdays: [1, 2, 3, 4, 5], holidays: [{ date: '2026-10-12' }] } } }
  assert.equal(caseDeadline(queja, [special], at('2026-10-09')).label, 'Vence en 2 días hábiles')
  special.snapshot.calendar.weekdays = [3]
  assert.equal(caseDeadline(queja, [special], at('2026-10-09')).label, 'Vence en 1 día hábil')
})
test('vencimiento de hoy y vencido no se presentan como tiempo restante positivo', () => {
  assert.equal(caseDeadline(queja, [run], at('2026-10-14')).label, 'Vence hoy')
  const result = caseDeadline(queja, [run], at('2026-10-16'))
  assert.equal(result.label, 'Venció hace 2 días hábiles')
  assert.equal(result.variant, 'red')
  assert.equal(result.progress, 100)
})
test('snapshot ausente, desconocido o corrupto conserva el fallback natural sin progreso inventado', () => {
  for (const snapshot of [null, {}, { rule: { day_type: 'fantasy', duration: 3 } }, { rule: run.snapshot.rule, calendar: { weekdays: [0], holidays: [] } }, { rule: run.snapshot.rule, calendar: { weekdays: [1,2,3,4,5], holidays: [{ date: '2026-02-31' }] } }]) {
    const result = caseDeadline(queja, [{ ...run, snapshot }], at('2026-10-09'))
    assert.equal(result.label, 'Vence en 5 días')
    assert.equal(result.progress, null)
    assert.equal(result.business, false)
  }
  assert.equal(caseDeadline(queja, [], at('2026-10-09')).progress, null)
})
test('duración inválida y lapsos gigantes no producen progreso ni bucles sin límite', () => {
  for (const duration of [-1, 0, 1.5, 50000]) assert.equal(caseDeadline(queja, [{ ...run, snapshot: { ...run.snapshot, rule: { ...run.snapshot.rule, duration } } }], at('2026-10-09')).progress, null)
  assert.equal(caseDeadline({ ...queja, plazo_vence: '2060-01-01T12:00:00Z' }, [{ ...run, expires_at: '2060-01-01T12:00:00Z' }], at('2026-10-09')).progress, 0)
})
test('revisión GC conserva el plazo de investigación y estados terminales no tienen pendiente', () => {
  const investigation = { ...run, stage_id: 'quejas.investigation' }
  const result = caseDeadline({ ...queja, estado: 'Pendiente de Revisión GC' }, [investigation], at('2026-10-12'))
  assert.equal(result.stageTitle, 'Investigación')
  assert.equal(result.vence, due)
  for (const estado of ['Resuelto', 'Finalizado', 'No Procede']) {
    const finished = caseDeadline({ ...queja, estado }, [run], at('2026-10-12'))
    assert.equal(finished.vence, null)
    assert.equal(finished.progress, null)
    assert.equal(finished.label, 'Completado')
  }
})

test('lecturas de seguimiento aíslan expediente, columnas y cancelación', async () => {
  const db = fakeDatabase({ qms_stage_runs: [{ ...run, case_id: 'A' }, { ...run, case_id: 'B', id: 'otro' }], queja_mail_outbox: [{ id: 'mailA', queja_id: 'A', tipo: 'recibido', status: 'pending' }, { id: 'mailB', queja_id: 'B' }] })
  const queries = loadModule('lib/queries/useQuejaSeguimiento.ts', { '@/lib/supabase': db, '@tanstack/react-query': { useQuery: opts => opts } })
  const controller = new AbortController()
  assert.equal((await queries.fetchQuejaPlazos('A', controller.signal)).length, 1)
  assert.equal(db.calls[0].signal, controller.signal)
  assert.equal(db.calls[0].end, 19)
  assert.equal((await queries.fetchQuejaCorreos('A'))[0].id, 'mailA')
  assert.equal(db.calls[1].columns, 'id,tipo,status,sent_at')
  const before = db.calls.length
  assert.equal((await queries.fetchQuejaPlazos('')).length, 0)
  assert.equal((await queries.fetchQuejaCorreos('')).length, 0)
  assert.equal(db.calls.length, before)
  assert.equal(queries.useQuejaCorreos('A', false).enabled, false)
  assert.equal(queries.useQuejaPlazos('').enabled, false)
  controller.abort()
  await assert.rejects(queries.fetchQuejaPlazos('A', controller.signal), /Aborted/)
})
test('fallos de seguimiento no se convierten en listas vacías exitosas', async () => {
  const db = fakeDatabase({}, { queja_mail_outbox: new Error('denegado') })
  const queries = loadModule('lib/queries/useQuejaSeguimiento.ts', { '@/lib/supabase': db })
  await assert.rejects(queries.fetchQuejaCorreos('A'), /denegado/)
})
