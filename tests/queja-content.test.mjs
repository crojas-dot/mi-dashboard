import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const { getQuejaAnalysis } = loadModule('lib/utils/quejaContent.ts')

test('copia plain del motor no duplica la justificación explícita Markdown', () => {
  const justification = '**Decisión**\n\nPrueba de recepción.'
  const queja = Object.freeze({ notas: '\n[Procede] ' + justification, notas_formato: 'plain', justificacion_procede: justification })
  assert.equal(getQuejaAnalysis(queja), null)
  assert.equal(queja.notas, '\n[Procede] ' + justification)
})

test('la justificación multilinea plain también se reconoce sin interpretar caracteres', () => {
  assert.equal(getQuejaAnalysis({ notas: '[Procede] **Texto literal**\n<dato>', justificacion_procede: '**Texto literal**\n<dato>' }), null)
})

test('un análisis independiente antes o después del apéndice se conserva', () => {
  const result = getQuejaAnalysis({ notas: 'Hallazgo previo.\n[Procede] Decisión\n\nNuevo hallazgo.', justificacion_procede: 'Decisión' })
  assert.equal(result.value, 'Hallazgo previo.\n\nNuevo hallazgo.')
  assert.equal(result.format, 'plain')
})

test('reapertura y otro bloque histórico no se confunden con procedencia duplicada', () => {
  const result = getQuejaAnalysis({ notas: '\n[Procede] Decisión\n[Reapertura] Información nueva\n[Procede] Decisión histórica distinta', justificacion_procede: 'Decisión' })
  assert.equal(result.value, '\n[Reapertura] Información nueva\n[Procede] Decisión histórica distinta')
})

test('notas sin justificación explícita siguen siendo texto literal, incluso con Markdown aparente', () => {
  const original = '\n[Procede] **Decisión antigua**\n\n<dato> & etiqueta'
  const result = getQuejaAnalysis({ notas: original })
  assert.equal(result.value, original)
  assert.equal(result.format, 'plain')
})

test('diferencias de texto conservan el bloque legacy completo', () => {
  for (const original of ['[Procede] Otra decisión', '[Procede] Decisión adicional', 'Cita [Procede] Decisión', ' [Procede] Decisión']) {
    assert.equal(getQuejaAnalysis({ notas: original, justificacion_procede: 'Decisión' }).value, original)
  }
})

test('formato Markdown explícito no se modifica como copia plain de compatibilidad', () => {
  const original = '## Hallazgos\n\n```\n[Procede] Decisión\n```'
  const result = getQuejaAnalysis({ notas: original, notas_formato: 'markdown', justificacion_procede: 'Decisión' })
  assert.equal(result.value, original)
  assert.equal(result.format, 'markdown')
})

test('varias copias completas no dejan un bloque vacío de análisis', () => {
  assert.equal(getQuejaAnalysis({ notas: '\n[Procede] Decisión\n[Procede] Decisión', justificacion_procede: 'Decisión' }), null)
})

test('saltos CRLF conservan el análisis original sin normalizar documentos', () => {
  const result = getQuejaAnalysis({ notas: '\r\n[Procede] Decisión\r\n[Reapertura] Nuevo dato', justificacion_procede: 'Decisión' })
  assert.equal(result.value, '\r\n[Reapertura] Nuevo dato')
})

test('campos vacíos no fabrican análisis ni justificación', () => {
  for (const queja of [{}, { notas: '' }, { notas: '\n ' }, { notas: '\n ', justificacion_procede: '  ' }]) {
    assert.equal(getQuejaAnalysis(queja), null)
  }
})
