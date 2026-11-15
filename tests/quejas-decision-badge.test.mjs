import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { default: DecisionBadge } = loadModule('app/quejas/components/DecisionProcedenciaBadge.tsx')

test('decisión del encabezado muestra ambas variantes sin borrar el texto redactado', () => {
  const yes = renderToStaticMarkup(createElement(DecisionBadge, { value: 'procede', onChange() {} }))
  const no = renderToStaticMarkup(createElement(DecisionBadge, { value: 'no_procede', onChange() {} }))
  assert.match(yes, /data-decision-badge/)
  assert.match(yes, /bg-blue-50 text-blue-700/)
  assert.match(yes, /aria-haspopup="menu"/)
  assert.match(no, /bg-red-50 text-red-700/)
  assert.match(no, /No Procede/)
  const modal = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  assert.match(modal, /titleAccessory=\{decisionOpen && decisionProcedencia \? <DecisionProcedenciaBadge/)
  const handler = modal.match(/onChange=\{next => \{([^}]+)\}\} \/> : undefined\}/)?.[1] ?? ''
  assert.match(handler, /setDecisionProcedencia\(next\)/)
  assert.doesNotMatch(handler, /setJustificacion|setJustificacionFormato|closeEditor/)
  assert.match(modal, /decisionProcedencia === 'procede' && <ResponsablePicker/)
  assert.match(modal, /if \(!responsable\) \{/)
})

test('la evaluación omite responsable por asignar y ancla la acción al fondo', () => {
  const { CaseAction } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx')
  const markup = renderToStaticMarkup(createElement(CaseAction, {
    queja: { id: 'case', folio: '2026-001', estado: 'Recibido', estado_color: 'blue' },
    runs: [], presentation: 'reference',
  }, createElement('button', null, 'Tomar decisión')))
  assert.match(markup, /Evaluar procedencia/)
  assert.match(markup, /data-case-action-reference/)
  assert.doesNotMatch(markup, /Responsable|Por asignar/)
  assert.match(markup, /mt-auto/)
  assert.match(markup, /Tomar decisión/)
})
