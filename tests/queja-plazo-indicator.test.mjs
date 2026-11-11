import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { default: Indicator } = loadModule('components/quejas/QuejaPlazoIndicator.tsx')
const render = deadline => renderToStaticMarkup(createElement(Indicator, { deadline }))

test('el semáforo conserva el texto, fecha y nivel ya calculados', () => {
  for (const [variant, label, color] of [['green', 'Vence en 9 días', 'success'], ['amber', 'Vence hoy', 'warning'], ['red', 'Venció hace 2 días', 'danger']]) {
    const deadline = Object.freeze({ variant, vence: '2026-11-12T18:00:00Z', label })
    const result = render(deadline)
    assert.match(result, new RegExp(`aria-hidden="true"[^>]*bg-qms-${color}`))
    assert.ok(result.includes(label))
    assert.match(result, /title="Fecha límite:/)
    assert.doesNotMatch(result, /font-semibold|bg-qms-primary|bg-qms-neutral-soft/)
    assert.equal(deadline.vence, '2026-11-12T18:00:00Z')
  }
})

test('completado y sin plazo usan punto gris conservando su explicación visible', () => {
  for (const [variant, label] of [['green', 'Completado'], ['gray', 'Sin plazo']]) {
    const result = render({ variant, label, vence: null })
    assert.match(result, /aria-hidden="true"[^>]*bg-qms-muted/)
    assert.ok(result.includes(label))
    assert.doesNotMatch(result, /title="Fecha límite|bg-qms-success/)
  }
})
