import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const { estadoPlazo, contarPlazos, formatoFechaPlazo } = loadModule('components/dashboard/plazos.ts')
const ahora = new Date(2026, 8, 23, 12).getTime()

test('un plazo sin hora vence al terminar el día local, no al comenzar', () => {
  assert.equal(estadoPlazo('2026-09-23', ahora), 'Vence hoy')
  assert.equal(estadoPlazo('2026-09-22', ahora), 'Vencido')
  assert.equal(estadoPlazo('2026-09-24', ahora), 'Por vencer')
})

test('los plazos con hora conservan su instante exacto', () => {
  assert.equal(estadoPlazo(new Date(ahora - 1).toISOString(), ahora), 'Vencido')
  assert.equal(estadoPlazo(new Date(ahora + 60000).toISOString(), ahora), 'Vence hoy')
})

test('fechas ausentes o inválidas nunca aparentan estar a tiempo', () => {
  for (const fecha of [null, undefined, '', 'no-es-fecha']) {
    assert.equal(estadoPlazo(fecha, ahora), 'Sin fecha')
  }
})

test('la fecha visible conserva el día y el año registrados', () => {
  const fecha = formatoFechaPlazo('2026-09-23')
  assert.match(fecha, /23/)
  assert.match(fecha, /2026/)
  assert.equal(formatoFechaPlazo('inválida'), 'Sin fecha')
})

test('el mismo instante puede ser hoy o vencido según la zona elegida', () => {
  const ahoraLimite = Date.parse('2026-01-01T05:30:00Z')
  assert.equal(estadoPlazo('2025-12-31', ahoraLimite, 'America/Costa_Rica'), 'Vence hoy')
  assert.equal(estadoPlazo('2025-12-31', ahoraLimite, 'America/Panama'), 'Vencido')
  assert.match(formatoFechaPlazo('2026-01-01', 'America/Costa_Rica'), /2026/)
  assert.match(formatoFechaPlazo('2026-01-01T03:00:00Z', 'America/Costa_Rica'), /2025/)
})

test('la distribución cuenta cada expediente una vez, incluidos los que no tienen fecha', () => {
  const filas = ['2026-09-22', '2026-09-23', '2026-09-24', null, '']
  const grupos = contarPlazos(filas, (fecha) => fecha, ahora)
  assert.equal(grupos.reduce((total, grupo) => total + grupo.total, 0), filas.length)
  assert.equal(grupos.find((grupo) => grupo.etiqueta === 'Sin fecha').total, 2)
  assert.equal(grupos.find((grupo) => grupo.etiqueta === 'Vencido').total, 1)
})
