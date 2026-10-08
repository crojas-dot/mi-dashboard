import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'
import { loadModule } from './load-module.mjs'
import { scanVisualImports } from '../scripts/audit-ui-migration.mjs'

const batch = Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/step4-batch1-business.json', 'utf8')))

test('los listados y formularios operativos usan el kit activo sin imports legacy', () => {
  const inventory = scanVisualImports()
  for (const file of batch) {
    const entry = inventory.find(entry => entry.file === file)
    assert.deepEqual(entry.coreui, [], file)
    assert.deepEqual(entry.unprefixedClasses, [], file)
    assert.deepEqual(entry.cssModules, [], file)
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /components\/ui\/tailwind|@coreui\/|\.module\.css/, file)
  }
})

test('los seis formularios conservan etiquetas asociadas, campos nativos y submit', () => {
  for (const file of [...batch.filter(file => file.includes('/components/')), 'app/documentos/components/NuevoDocumentoModal.tsx']) {
    const { default: Form } = loadModule(file, {
      react: { ...React, useState: value => [value, () => {}], useRef: current => ({ current }) },
      '@/components/Modal': { default: ({ children }) => createElement('section', null, children) },
      '@/lib/supabase': { supabase: {} },
      '@/lib/services/folioService': {}, '@/lib/services/errorToast': {},
    })
    const html = renderToStaticMarkup(Form({ open: true, onClose() {}, onCreated() {} }))
    const ids = [...html.matchAll(/(?:input|textarea|select)\b[^>]*\bid="([^"]+)"/g)].map(match => match[1])
    const labels = [...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(match => match[1])
    assert.ok(ids.length > 0, file)
    assert.equal(new Set(ids).size, ids.length, 'IDs únicos: ' + file)
    assert.deepEqual(labels.sort(), ids.sort(), file)
    assert.match(html, /<button\b[^>]*type="submit"/, file)
    assert.doesNotMatch(html, /class="(?:form-control|btn|modal)\b/, file)
  }
})

test('Table conserva semántica, atributos de celdas y acceso por teclado a filas interactivas', () => {
  const { Table, TableHead, TableHeaderCell, TableRow, TableCell } = loadModule('components/ui/Table.tsx')
  const html = renderToStaticMarkup(createElement(Table, { 'aria-label': 'Procesos' },
    createElement(TableHead, null, createElement('tr', null, createElement(TableHeaderCell, null, 'Nombre'))),
    createElement('tbody', null, createElement(TableRow, null, createElement(TableCell, { colSpan: 2 }, 'Proceso'))),
  ))
  assert.match(html, /<table\b[^>]*aria-label="Procesos"/)
  assert.match(html, /<thead/)
  assert.match(html, /<th\b[^>]*scope="col"/)
  assert.match(html, /<td\b[^>]*colSpan="2"/i)
  let opens = 0
  const row = TableRow({ onClick: () => opens++, children: null })
  const target = { click: () => opens++ }
  row.props.onKeyDown({ key: 'Enter', target, currentTarget: target, preventDefault() {} })
  row.props.onKeyDown({ key: 'Enter', target: {}, currentTarget: target, preventDefault() {} })
  assert.equal(opens, 1, 'no abrir la fila al pulsar un control dentro de ella')
  assert.equal(row.props.tabIndex, 0)
})

test('Pagination bloquea navegación durante refresco y preserva límites y callbacks', () => {
  const { default: Pagination } = loadModule('components/ui/Pagination.tsx', { '@/lib/queries/pagination': { PAGE_SIZE: 25 } })
  const html = renderToStaticMarkup(createElement(Pagination, { page: 0, count: 75, busy: true, onChange() {} }))
  assert.equal([...html.matchAll(/<button\b[^>]*disabled=""/g)].length, 2)
  assert.match(html.replace(/<[^>]+>/g, ''), /Página 1 de 3/)
  const changes = []
  const element = Pagination({ page: 1, count: 75, onChange: value => changes.push(value) })
  const controls = element.props.children[1].props.children
  controls[0].props.onClick()
  controls[2].props.onClick()
  assert.deepEqual(changes, [0, 2])
})

test('Badge conserva un fallback visual seguro para estados desconocidos', () => {
  const { default: Badge } = loadModule('components/ui/Badge.tsx')
  const html = renderToStaticMarkup(createElement(Badge, { variant: 'toString' }, 'Pendiente'))
  assert.match(html, /bg-qms-muted/)
  assert.match(html, />Pendiente</)
})