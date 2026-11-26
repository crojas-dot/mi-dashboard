import assert from 'node:assert/strict'
import test from 'node:test'
import { loadModule } from './load-module.mjs'

const { getQuejaDeadline, getQuejaDeadlineDate, formatQuejaDeadlineDate } = loadModule('lib/utils/quejaDeadline.ts')
const now = Date.parse('2026-10-09T18:00:00Z')

test('el plazo vigente viene del snapshot y no de prioridad o antigüedad', () => {
  const queja = { estado: 'En Investigación', plazo_vence: '2026-10-20T05:59:59.999999Z', fecha_sla: '2026-01-01T00:00:00Z', fecha_limite_investigacion: '2026-10-19T05:59:59.999999Z' }
  const result = getQuejaDeadline(queja, now)
  assert.equal(result.vence, queja.plazo_vence)
  assert.equal(result.label, 'Vence el 19/10/2026')
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
  assert.equal(result.label, 'Vencido')
  assert.equal(result.variant, 'red')
  assert.equal(result.vencido, true)
})

test('la situación de atención no cambia el verde de un plazo que aún tiene más de un día', () => {
  const result = getQuejaDeadline({ estado: 'En Investigación', plazo_vence: '2026-10-20T05:59:59Z', plazo_situacion: 'attention', plazo_dias: 3 }, now)
  assert.equal(result.variant, 'green')
  assert.equal(result.label, 'Vence el 19/10/2026')
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


test('un vencimiento de mañana es verde aunque la situación provenga de una alerta', () => {
  const result = getQuejaDeadline({ estado: 'Recibido', plazo_vence: '2026-10-10T18:00:00Z', plazo_situacion: 'attention' }, now)
  assert.equal(result.label, 'Vence mañana')
  assert.equal(result.variant, 'green')
})

test('un vencimiento de hoy no pasa a Vencido solo por ser anterior a la hora actual', () => {
  const result = getQuejaDeadline({ estado: 'Recibido', plazo_vence: '2026-10-09T06:00:00Z' }, now)
  assert.equal(result.label, 'Vence hoy')
  assert.equal(result.variant, 'red')
  assert.equal(result.vencido, false)
})

test('un atraso de 1, 30 o 100 días siempre se representa como Vencido', () => {
  for (const days of [1, 30, 100]) {
    const deadline = new Date(now - days * 86400_000).toISOString()
    const result = getQuejaDeadline({ estado: 'Recibido', bandeja_plazo_vence: deadline }, now)
    assert.equal(result.label, 'Vencido')
    assert.equal(result.variant, 'red')
  }
})

test('los plazos históricos permanecen visibles cuando la vista los informa', () => {
  const result = getQuejaDeadline({ estado: 'En Investigación', plazo_vence: null, bandeja_plazo_vence: '2026-10-01T18:00:00Z' }, now)
  assert.equal(result.label, 'Vencido')
})

test('finalizados tienen prioridad sobre el plazo y siempre son grises', () => {
  for (const estado of ['Resuelto', 'Finalizado', 'No Procede', 'Cerrado', 'Cerrada']) {
    const result = getQuejaDeadline({ estado, bandeja_plazo_vence: '2026-10-01T18:00:00Z' }, now)
    assert.equal(result.label, 'Completado')
    assert.equal(result.variant, 'gray')
  }
})

test('reapertura presenta días hábiles capturados sin afectar expedientes normales', () => {
  const fecha = '2026-11-30T23:59:59Z'
  const reopened = getQuejaDeadline({
    estado: 'En Investigación', reabierta: true,
    bandeja_plazo_vence: fecha, reapertura_dias_habiles_restantes: 15,
  }, now)
  assert.equal(reopened.label, 'Vence en 15 días hábiles')
  const normal = getQuejaDeadline({
    estado: 'En Investigación', reabierta: false,
    bandeja_plazo_vence: fecha, reapertura_dias_habiles_restantes: 15,
  }, now)
  assert.equal(normal.label, 'Vence el 30/11/2026')
})
