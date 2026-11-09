import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, fakeDatabase } from './load-module.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const model = loadModule('lib/utils/qmsCalendar.ts')
const calendar = { id: 7, weekdays: [1, 2, 3, 4, 5], holidays: [], timezone: 'America/Costa_Rica', created_at: '2026-10-15T17:00:00Z' }
const draft = () => ({ weekdays: [1, 2, 3, 4, 5], holidays: [{ date: '2027-01-01', description: 'Año nuevo' }], reason: 'Calendario institucional aprobado' })

test('valida fechas civiles reales sin desplazar el día por UTC ni aceptar normalización automática', () => {
  for (const date of ['2028-02-29', '2000-02-29', '2027-01-01', '0001-01-01']) assert.equal(model.esFechaCalendarioQms(date), true, date)
  for (const date of ['2027-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '0000-01-01', '2026-1-1', '2026-01-01T00:00:00Z', null])
    assert.equal(model.esFechaCalendarioQms(date), false, String(date))
})

test('exige días ISO únicos, al menos uno, sin aceptar texto ni fracciones', () => {
  for (const weekdays of [[], [0], [8], [1, 1], ['1'], [1.5], [1, null]])
    assert.match(model.validarCalendarioQms({ ...draft(), weekdays }), /día laboral/)
  assert.equal(model.validarCalendarioQms({ ...draft(), weekdays: [7] }), null)
})

test('Añadir feriado comparte validación de límites, duplicados y descripciones con el guardado', () => {
  assert.equal(model.validarFeriadosCalendarioQms(draft().holidays), null)
  assert.match(model.validarFeriadosCalendarioQms([...draft().holidays, ...draft().holidays]), /repetidas/)
  for (const description of ['', '   ', 'x'.repeat(201), 'Día\u0000especial', 'Día\nespecial'])
    assert.match(model.validarFeriadosCalendarioQms([{ date: '2027-01-01', description }]), /descripción/)
  const tooMany = Array.from({ length: 1001 }, () => draft().holidays[0])
  assert.match(model.validarFeriadosCalendarioQms(tooMany), /1000/)
})

test('exige motivo acotado para crear versión, preservando acentos y saltos de línea normales', () => {
  for (const reason of ['', '   ', 'x'.repeat(501), 'motivo\u0001'])
    assert.match(model.validarCalendarioQms({ ...draft(), reason }), /motivo/)
  assert.equal(model.validarCalendarioQms({ ...draft(), reason: 'Acuerdo institucional\nSesión de octubre' }), null)
})

test('normaliza orden y espacios sin mutar borradores, fechas ni revisiones', () => {
  const input = { weekdays: [5, 1], holidays: [{ date: '2027-12-25', description: ' Navidad ' }, { date: '2027-01-01', description: ' Año nuevo ' }], reason: ' Motivo ' }
  const before = clone(input), result = clone(model.normalizarCalendarioQms(input))
  assert.deepEqual(input, before)
  assert.deepEqual(result, { weekdays: [1, 5], holidays: [{ date: '2027-01-01', description: 'Año nuevo' }, { date: '2027-12-25', description: 'Navidad' }], reason: 'Motivo' })
  assert.equal(model.calendarioQmsCambio({ ...calendar, weekdays: [5, 1], holidays: result.holidays }, input), false)
  assert.equal(model.calendarioQmsCambio(calendar, draft()), true)
  assert.equal(model.calendarioQmsCambio(calendar, { ...draft(), holidays: [], reason: 'Otro motivo' }), false)
})

test('lector solo conserva el contrato de calendario, sin autores o metadatos extra', () => {
  assert.deepEqual(clone(model.parseQmsCalendar({ ...calendar, created_by: 'private-actor', extra: 'omitido' })), calendar)
  for (const row of [{ ...calendar, id: Number.MAX_SAFE_INTEGER + 1 }, { ...calendar, weekdays: [] }, { ...calendar, created_at: '' }, { ...calendar, holidays: [null] }, null])
    assert.throws(() => model.parseQmsCalendar(row), /no disponible/)
})

test('lectura trae una sola versión vigente con columnas explícitas y señal de cancelación', async () => {
  const db = fakeDatabase({ qms_calendars: [{ ...calendar, id: 1 }, calendar] })
  const { fetchQmsCalendar } = loadModule('lib/queries/useQmsCalendar.ts', { '@/lib/supabase': { supabase: db.supabase } })
  const controller = new AbortController(), result = await fetchQmsCalendar(controller.signal)
  assert.equal(result.id, 7)
  assert.equal(db.calls.length, 1)
  assert.equal(db.calls[0].end, 0)
  assert.equal(db.calls[0].columns, 'id,weekdays,holidays,timezone,created_at')
  assert.equal(db.calls[0].signal, controller.signal)
  controller.abort()
  await assert.rejects(fetchQmsCalendar(controller.signal), { name: 'AbortError' })
})

test('una lectura vacía o fallida no inventa calendario ni versión', async () => {
  const empty = loadModule('lib/queries/useQmsCalendar.ts', { '@/lib/supabase': { supabase: fakeDatabase({}).supabase } })
  assert.equal(await empty.fetchQmsCalendar(), null)
  const failure = { code: '42501' }
  const denied = loadModule('lib/queries/useQmsCalendar.ts', { '@/lib/supabase': { supabase: fakeDatabase({}, { qms_calendars: failure }).supabase } })
  await assert.rejects(denied.fetchQmsCalendar(), error => error === failure)
})

test('publicación usa RPC autenticado y revisión original, sin writes directos ni campos sobrantes', async () => {
  const calls = []
  const { publicarCalendarioQms } = loadModule('lib/services/qmsCalendarService.ts', {
    '@/lib/supabase': { supabase: { rpc: async (...args) => { calls.push(args); return { data: 8, error: null } } } },
  })
  const input = { ...draft(), reason: '  Motivo aprobado  ', created_by: 'no-admitido', id: 99 }
  assert.equal(await publicarCalendarioQms(7, input), 8)
  assert.deepEqual(clone(calls), [['qms_publish_calendar', { p_expected: 7, p_weekdays: [1, 2, 3, 4, 5], p_holidays: draft().holidays, p_reason: 'Motivo aprobado' }]])
  assert.equal(input.reason, '  Motivo aprobado  ')
})

test('validación falla antes de cualquier efecto remoto', async () => {
  let calls = 0
  const { publicarCalendarioQms } = loadModule('lib/services/qmsCalendarService.ts', {
    '@/lib/supabase': { supabase: { rpc: async () => { calls++; throw Error('unexpected request') } } },
  })
  for (const expected of [0, -1, NaN, '7', null, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(publicarCalendarioQms(expected, draft()), /Actualizá/)
  await assert.rejects(publicarCalendarioQms(7, { ...draft(), weekdays: [] }), /día laboral/)
  await assert.rejects(publicarCalendarioQms(7, { ...draft(), reason: '' }), /motivo/)
  assert.equal(calls, 0)
})

test('conflicto CAS conserva el error y no lee una revisión nueva ni reintenta', async () => {
  const calls = [], conflict = { code: '40001', message: 'El calendario cambió.' }
  const { publicarCalendarioQms } = loadModule('lib/services/qmsCalendarService.ts', {
    '@/lib/supabase': { supabase: { rpc: async (...args) => { calls.push(args); return { data: null, error: conflict } } } },
  })
  await assert.rejects(publicarCalendarioQms(7, draft()), error => error === conflict)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].p_expected, 7)
})

test('respuesta sin revisión válida no se anuncia como confirmada ni causa reintento automático', async () => {
  let calls = 0
  const { publicarCalendarioQms } = loadModule('lib/services/qmsCalendarService.ts', {
    '@/lib/supabase': { supabase: { rpc: async () => { calls++; return { data: null, error: null } } } },
  })
  await assert.rejects(publicarCalendarioQms(7, draft()), /confirmar/)
  assert.equal(calls, 1)
})

test('calendario comparte el tier acotado de Configuración', () => {
  const { queryKeys } = loadModule('lib/queries/queryKeys.ts')
  const { getCacheConfig, CACHE_CONFIG } = loadModule('lib/queries/cacheConfig.ts')
  assert.deepEqual(clone(queryKeys.qmsCalendar), ['qms_calendar'])
  assert.deepEqual(clone(getCacheConfig(queryKeys.qmsCalendar)), clone(CACHE_CONFIG.configuraciones))
})
