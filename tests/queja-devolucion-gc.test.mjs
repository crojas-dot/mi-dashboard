import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const { obtenerDevolucionPendiente, esNotaInvestigacion, NOTA_DEVOLUCION_PREFIX, NOTA_APROBACION_GC } =
  loadModule('lib/utils/quejaInvestigacionNotas.ts')

const actividad = (id, descripcion, tipo = 'nota') => ({
  id: String(id), tipo, descripcion, created_at: `2026-11-12T15:${String(id).padStart(2, '0')}:00Z`,
})

test('investigación inicial usa Enviar a Revisión GC, sin aviso de devolución', () => {
  assert.equal(obtenerDevolucionPendiente('En Investigación', [actividad(1, 'Nota de investigación')]), undefined)
})

test('devolución activa muestra el motivo debajo de la acción y habilita reenvío', () => {
  const events = [actividad(1, 'Nota de investigación'), actividad(2, NOTA_DEVOLUCION_PREFIX + 'Ampliar evidencia del hallazgo')]
  const result = obtenerDevolucionPendiente('En Investigación', events)
  assert.deepEqual({ ...result }, { motivo: 'Ampliar evidencia del hallazgo', fecha: events[1].created_at })
  assert.equal(esNotaInvestigacion(events[1]), false)
})

test('reenviar a GC retira el aviso y el botón mientras espera otra decisión', () => {
  const history = [actividad(1, NOTA_DEVOLUCION_PREFIX + 'Revisar evidencia')]
  assert.equal(obtenerDevolucionPendiente('Pendiente de Revisión GC', history), undefined)
  assert.equal(obtenerDevolucionPendiente('Resuelto', history), undefined)
  assert.equal(obtenerDevolucionPendiente('Finalizado', history), undefined)
})

test('una segunda devolución actualiza el motivo; otras notas no reemplazan la última decisión', () => {
  const events = [
    actividad(1, NOTA_DEVOLUCION_PREFIX + 'Primer motivo'),
    actividad(2, 'Nota propia del responsable'),
    actividad(3, NOTA_DEVOLUCION_PREFIX + 'Segundo motivo'),
    actividad(4, 'Seguimiento de investigación'),
  ]
  assert.equal(obtenerDevolucionPendiente('En Investigación', events)?.motivo, 'Segundo motivo')
})

test('una aprobación posterior impide reactivar devoluciones históricas al reabrir', () => {
  const events = [actividad(1, NOTA_DEVOLUCION_PREFIX + 'Devolución anterior'), actividad(2, NOTA_APROBACION_GC)]
  assert.equal(obtenerDevolucionPendiente('En Investigación', events), undefined)
  assert.equal(esNotaInvestigacion(events[1]), false)
  events.push(actividad(3, NOTA_DEVOLUCION_PREFIX + 'Nueva devolución'))
  assert.equal(obtenerDevolucionPendiente('En Investigación', events)?.motivo, 'Nueva devolución')
})

test('una nota corriente que imita la devolución no altera el flujo', () => {
  const forged = actividad(1, NOTA_DEVOLUCION_PREFIX + 'No es una devolución', 'comentario')
  assert.equal(obtenerDevolucionPendiente('En Investigación', [forged]), undefined)
})

test('el historial de notas no se modifica al identificar la devolución', () => {
  const events = [actividad(1, NOTA_DEVOLUCION_PREFIX + 'A'), actividad(2, NOTA_APROBACION_GC)]
  const copy = events.slice()
  obtenerDevolucionPendiente('En Investigación', events)
  assert.deepEqual(events, copy)
})
