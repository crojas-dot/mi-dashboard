import assert from 'node:assert/strict'
import test from 'node:test'
import { loadModule } from './load-module.mjs'

const { getQuejaDeadline, getQuejaDeadlineDate, formatQuejaDeadlineDate } = loadModule('lib/utils/quejaDeadline.ts')
const now = Date.parse('2026-10-09T18:00:00Z')

test('el plazo vigente viene del snapshot y no de prioridad o antigüedad', () => {
  const queja = { estado: 'En Investigación', plazo_vence: '2026-10-20T05:59:59.999999Z', fecha_sla: '2026-01-01T00:00:00Z', fecha_limite_investigacion: '2026-10-19T05:59:59.999999Z' }
  const result = getQuejaDeadline(queja, now)
  assert.equal(result.vence, queja.plazo_vence)
  assert.equal(result.label, 'Vence en 10 días')
  assert.equal(result.variant, 'green')
})

test('fixtures antiguos usan la columna correspondiente a la etapa y conservan investigación durante revisión GC', () => {
  const columns = { fecha_sla: '2026-10-10T05:59:59Z', fecha_limite_investigacion: '2026-10-20T05:59:59Z' }
  assert.equal(getQuejaDeadlineDate({ ...columns, estado: 'Recibido' }), columns.fecha_sla)
  for (const estado of ['En Investigación', 'Pendiente de Revisión GC'])
    assert.equal(getQuejaDeadlineDate({ ...columns, estado }), columns.fecha_limite_investigacion)
})

test('no inventa una fecha si el motor confirma que no existe un plazo vigente', () => {
  const result = getQuejaDeadline({ estado: 'Recibido', plazo_vence: null, fecha_sla: '2026-10-10T05:59:59Z' }, now)
  assert.equal(result.vence, null)
  assert.equal(result.label, 'Sin plazo')
  assert.equal(result.variant, 'gray')
})

test('la fecha y Vence hoy respetan Costa Rica aun si el vencimiento UTC cae al día siguiente', () => {
  const result = getQuejaDeadline({ estado: 'Recibido', plazo_vence: '2026-10-10T05:59:59.999999Z' }, now)
  assert.equal(result.label, 'Vence hoy')
  assert.equal(result.variant, 'red')
  assert.equal(formatQuejaDeadlineDate(result.vence), '09/10/2026')
})

test('un snapshot vencido se muestra vencido aunque su situación viniera de una lectura anterior', () => {
  const result = getQuejaDeadline({ estado: 'Recibido', plazo_vence: '2026-10-09T05:59:59Z', plazo_situacion: 'on_time' }, now)
  assert.equal(result.label, 'Venció ayer')
  assert.equal(result.variant, 'red')
  assert.equal(result.vencido, true)
})

test('una alerta interna no reemplaza el semáforo global de vencimiento', () => {
  const result = getQuejaDeadline({ estado: 'En Investigación', plazo_vence: '2026-10-20T05:59:59Z', plazo_situacion: 'attention', plazo_dias: 3 }, now)
  assert.equal(result.variant, 'green')
  assert.equal(result.label, 'Vence en 10 días')
})

test('usa los códigos de etapa y situación emitidos por el motor efectivo de DB', () => {
  const queja = { estado: 'En Investigación', plazo_vence: '2026-10-20T05:59:59Z', plazo_situacion: 'soon' }
  assert.equal(getQuejaDeadline(queja, now).variant, 'green')
  assert.equal(getQuejaDeadline(queja, now).etapa, 'quejas.investigation')
  assert.equal(getQuejaDeadline({ ...queja, estado: 'Recibido', plazo_situacion: 'within' }, now).etapa, 'quejas.evaluation')
})

test('todos los estados terminales retiran el plazo operativo sin esconder la fecha histórica de la fila', () => {
  for (const estado of ['Resuelto', 'Finalizado', 'No Procede']) {
    const queja = { estado, fecha_sla: '2026-01-01T00:00:00Z', plazo_vence: '2026-01-01T00:00:00Z' }
    assert.equal(getQuejaDeadlineDate(queja), null)
    const result = getQuejaDeadline(queja, now)
    assert.equal(result.label, 'Completado')
    assert.equal(result.variant, 'gray')
    assert.equal(result.vencido, false)
    assert.equal(queja.fecha_sla, '2026-01-01T00:00:00Z')
  }
})

test('fechas ausentes o inválidas muestran un estado neutral', () => {
  for (const plazo_vence of [null, '', 'no-date']) {
    assert.equal(getQuejaDeadline({ estado: 'Recibido', plazo_vence }, now).label, 'Sin plazo')
    assert.equal(formatQuejaDeadlineDate(plazo_vence), '—')
  }
})

test('mañana, hoy, ayer y el límite global de 30 días son exactos en Costa Rica', () => {
  const referencia = Date.parse('2026-11-15T18:00:00Z')
  const vence = day => getQuejaDeadline({ estado: 'Recibido', plazo_vence: day + 'T18:00:00Z' }, referencia)
  assert.deepEqual([vence('2026-11-16').label, vence('2026-11-16').variant], ['Vence mañana', 'green'])
  assert.deepEqual([vence('2026-11-15').label, vence('2026-11-15').variant], ['Vence hoy', 'red'])
  assert.deepEqual([vence('2026-11-14').label, vence('2026-11-14').variant], ['Venció ayer', 'red'])
  assert.equal(vence('2026-10-16').label, 'Venció hace 30 días')
  assert.equal(vence('2026-10-15').label, 'Vencido')
  const terminal = getQuejaDeadline({ estado: 'Finalizado', plazo_vence: '2026-10-15T18:00:00Z' }, referencia)
  assert.deepEqual([terminal.label, terminal.variant], ['Completado', 'gray'])
})
