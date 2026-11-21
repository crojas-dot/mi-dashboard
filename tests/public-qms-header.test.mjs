import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { default: PublicQmsHeader } = loadModule('app/q/components/PublicQmsHeader.tsx')

test('el formulario y el seguimiento reutilizan la cabecera institucional de confirmación', () => {
  const logo = 'https://example.test/eca.png'
  const html = renderToStaticMarkup(createElement(PublicQmsHeader, {
    title: 'QMS ECA', subtitle: 'Gestión de Calidad', logo,
  }))
  assert.match(html, /QMS ECA/)
  assert.match(html, /Gestión de Calidad/)
  assert.match(html, /border-b border-qms-border/)
  assert.match(html, /alt="Logo institucional"/)
  assert.match(html, /https:\/\/example\.test\/eca\.png/)
})

test('sin imagen la cabecera conserva el nombre institucional y no dibuja un logo falso', () => {
  const html = renderToStaticMarkup(createElement(PublicQmsHeader, {
    title: 'Registro de queja', subtitle: 'Formulario GC', Title: 'h1',
  }))
  assert.match(html, /<h1[^>]*>Registro de queja<\/h1>/)
  assert.match(html, /Formulario GC/)
  assert.doesNotMatch(html, /<img/)
})
