import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule, fakeDatabase } from './load-module.mjs'

const Pagination = loadModule('components/ui/Pagination.tsx', { '@/lib/queries/pagination': { PAGE_SIZE: 25 } }).default
const buttons = node => Array.isArray(node) ? node.flatMap(buttons) : node?.props ? [...(node.props.onClick ? [node] : []), ...buttons(node.props.children)] : []

test('el paginador muestra dos acciones y el número de página incluso con 100 páginas', () => {
  const html = renderToStaticMarkup(createElement(Pagination, { page: 42, count: 2500, onChange() {} }))
  assert.equal((html.match(/<button/g) ?? []).length, 2)
  assert.match(html, /43<\/span> de 100/)
  assert.match(html, /Página anterior/)
  assert.match(html, /Página siguiente/)
})

test('anterior y siguiente cambian la página y respetan límites y carga', () => {
  const changes = []
  const props = { count: 126, onChange: page => changes.push(page) }
  const middle = buttons(Pagination({ ...props, page: 2 }))
  middle.forEach(button => button.props.onClick())
  assert.deepEqual(changes, [1, 3])
  assert.equal(buttons(Pagination({ ...props, page: 0 }))[0].props.disabled, true)
  assert.equal(buttons(Pagination({ ...props, page: 5 }))[1].props.disabled, true)
  assert.ok(buttons(Pagination({ ...props, page: 2, busy: true })).every(button => button.props.disabled))
  assert.equal(Pagination({ ...props, page: 0, count: 25 }), null)
})

test('las seis páginas devuelven los 126 registros una sola vez, incluso con fechas idénticas', async () => {
  const rows = Array.from({ length: 126 }, (_, i) => ({ id: `q-${String(126 - i).padStart(3, '0')}`, fecha: '2026-10-06', responsable_id: 'usuario-demo', estado: 'Recibido' }))
  const db = fakeDatabase({ quejas: rows })
  const { fetchQuejas, quejasKey } = loadModule('lib/queries/useQuejas.ts', { '@/lib/supabase': db, '@tanstack/react-query': {} })
  const ids = []
  for (let page = 0; page < 6; page++) {
    const result = await fetchQuejas({ page, responsableId: 'usuario-demo', estado: 'Recibido' })
    assert.equal(result.count, 126)
    assert.equal(result.data.length, page === 5 ? 1 : 25)
    ids.push(...result.data.map(row => row.id))
  }
  assert.equal(new Set(ids).size, 126)
  assert.equal(ids[0], 'q-001')
  assert.equal(ids.at(-1), 'q-126')
  assert.notDeepEqual(quejasKey({ page: 0 }), quejasKey({ page: 1 }))
  assert.equal((await fetchQuejas({ responsableId: 'otro-usuario' })).count, 0)
})
