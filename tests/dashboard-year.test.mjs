import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const { partesEnZona, mesesDelAnio } = loadModule('lib/timeZone.ts')

test('el año y el mes respetan Costa Rica al cruzar medianoche UTC', () => {
  assert.equal(partesEnZona('2026-01-01T00:30:00Z', 'America/Costa_Rica').anio, 2025)
  assert.equal(partesEnZona('2026-01-01T06:30:00Z', 'America/Costa_Rica').anio, 2026)
  assert.equal(partesEnZona('2026-02-01T02:00:00Z', 'America/Costa_Rica').mes, 1)
})

test('el calendario civil publica enero al mes actual de la zona seleccionada', () => {
  const calendario = mesesDelAnio('2026-09-23T12:00:00Z', 'America/Costa_Rica')
  assert.equal(calendario.anio, 2026)
  assert.equal(calendario.meses.length, 9)
  assert.equal(calendario.meses[0], 'Ene')
  assert.ok(calendario.meses.every((mes) => !/\d{2}$/.test(mes)))
})
