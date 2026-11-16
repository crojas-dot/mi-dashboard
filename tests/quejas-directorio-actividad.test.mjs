import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadModule } from './load-module.mjs'

const { detalleFechaIngreso, fechaIngresoCorta, estadoQuejaEnTabla } =
  loadModule('lib/utils/quejasListado.ts')
const ahora = Date.parse('2026-11-15T18:00:00Z')
const base = {
  fecha: '2026-11-10T18:00:00Z', estado: 'En Investigación',
  ultima_actividad_at: null, es_nuevo: false,
}
const detalle = overrides => JSON.parse(JSON.stringify(detalleFechaIngreso({ ...base, ...overrides }, ahora)))

test('fecha de ingreso usa Costa Rica y omite subtítulo sin evidencia de actividad', () => {
  assert.equal(fechaIngresoCorta('2026-11-14T18:00:00Z'), '14/11/2026')
  assert.equal(detalle({}), null)
  assert.equal(detalle({ ultima_actividad_at: 'no-fecha' }), null)
})

test('Nuevo tiene prioridad pero nunca se inventa por estado Recibido sin metadata del backend', () => {
  assert.deepEqual(detalle({ estado: 'Recibido', es_nuevo: true }), { texto: 'Nuevo', destacada: true })
  assert.equal(detalle({ estado: 'Recibido' }), null)
  assert.equal(detalle({ estado: 'Finalizado', es_nuevo: true }), null)
})

test('última actividad: hoy azul; ayer o hasta 30 días gris; después fecha exacta', () => {
  const d = dia => ({ ultima_actividad_at: dia + 'T18:00:00Z' })
  assert.deepEqual(detalle(d('2026-11-15')), { texto: 'Actualización: hoy', destacada: true })
  assert.deepEqual(detalle(d('2026-11-14')), { texto: 'Actualización: ayer', destacada: false })
  assert.deepEqual(detalle(d('2026-11-13')), { texto: 'Actualización: hace 2 días', destacada: false })
  assert.deepEqual(detalle({ fecha: '2026-10-01T18:00:00Z', ...d('2026-10-16') }), { texto: 'Actualización: hace 30 días', destacada: false })
  assert.deepEqual(detalle({ fecha: '2026-09-01T18:00:00Z', ...d('2026-10-15') }), { texto: 'Actualización: 15/10/2026', destacada: false })
  assert.equal(detalle({ estado: 'No Procede', ...d('2026-11-15') }), null)
  assert.equal(detalle({ estado: 'Finalizado', ...d('2026-11-15') }), null)
})

test('abreviar solo el estado de revisión en la tabla, no el código real', () => {
  assert.equal(estadoQuejaEnTabla('Pendiente de Revisión GC', 'Pendiente de Revisión GC'), 'Revisión GC')
  assert.equal(estadoQuejaEnTabla('En Investigación', 'En Investigación'), 'En Investigación')
})

test('Quejas y Mis Quejas comparten columnas y segunda línea sin modificar estados persistidos', () => {
  for (const file of ['app/quejas/page.tsx', 'app/mis-quejas/page.tsx']) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /<QuejaFechaIngreso queja=\{q\} ahora=\{ahora\}/)
    assert.match(source, /estadoQuejaEnTabla\(q.estado, q.estado_nombre\)/)
    assert.match(source, />Fecha de ingreso<\/th>/)
    assert.match(source, /table-fixed min-w-\[1100px\]/)
    assert.match(source, /<col className="w-\[13%\]"\s*\/>/)
    assert.match(source, /<col className="w-\[21%\]"\s*\/>/)
    assert.doesNotMatch(source, /toLocaleDateString\('es-ES'\)/)
    assert.match(source, /ui-case-row h-\[57px\]/)
    assert.match(source, /\[&>td\]:py-0/)
    assert.match(source, /\[&>td\]:align-middle/)
    assert.match(source, /min-w-\[1100px\]/)
    assert.doesNotMatch(source, /\[&>td\]:py-3\.5/)

  }
})

test('la consulta ordena globalmente por actividad antes del rango de paginación', () => {
  const source = readFileSync('lib/queries/useQuejas.ts', 'utf8')
  const start = source.indexOf(".from('qms_quejas_lista')")
  const nuevos = source.indexOf(".order('es_nuevo'", start)
  const actividad = source.indexOf(".order('fecha_orden_actividad'", nuevos)
  const fecha = source.indexOf(".order('fecha'", actividad)
  const pagina = source.indexOf('.range(page * pageSize', fecha)
  assert.ok(start !== -1 && nuevos > start && actividad > nuevos && fecha > actividad && pagina > fecha)
})

test('la fecha numérica incluye ceros iniciales y no altera la clasificación temporal', () => {
  assert.equal(fechaIngresoCorta('2026-11-03T18:00:00Z'), '03/11/2026')
  assert.equal(fechaIngresoCorta('2026-10-19T18:00:00Z'), '19/10/2026')
  assert.equal(fechaIngresoCorta('2026-11-15T03:30:00Z'), '14/11/2026', 'zona local Costa Rica')
  assert.deepEqual(detalle({ fecha: '2026-09-01T18:00:00Z', ultima_actividad_at: '2026-10-15T18:00:00Z' }), {
    texto: 'Actualización: 15/10/2026',
    destacada: false,
  })
})

test('el componente de fecha admite una o dos líneas sin aumentar el tamaño de fila', () => {
  const source = readFileSync('components/quejas/QuejaFechaIngreso.tsx','utf8')
  assert.match(source, /h-9 min-w-0 flex-col justify-center gap-0\.5/)
  assert.match(source, /whitespace-nowrap text-base/)
  assert.match(source, /whitespace-nowrap text-xs leading-\[15px\]/)
  assert.match(source, /data-queja-fecha-ingreso/)
})
