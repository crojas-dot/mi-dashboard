import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { loadModule } from './load-module.mjs'

const render = (component, props) => renderToStaticMarkup(createElement(component, props))

test('Button usa las recetas canónicas y conserva clases del consumidor', () => {
  const { default: Button } = loadModule('components/ui/Button.tsx')
  const html = render(Button, { variant: 'danger', size: 'sm', className: 'w-full', children: 'Eliminar' })
  assert.match(html, /ui-button-danger/)
  assert.match(html, /ui-button-sm/)
  assert.match(html, /w-full/)
  assert.doesNotMatch(html, /tw:|btn-danger/)
})

test('Button conserva atributos, ref y eventos; loading bloquea envíos y anuncia estado', () => {
  const { default: Button } = loadModule('components/ui/Button.tsx')
  const onClick = () => {}
  const ref = { current: null }
  const element = Button({ children: 'Guardar', onClick, ref, 'aria-label': 'Guardar queja' })
  assert.equal(element.props.onClick, onClick)
  assert.equal(element.props.ref, ref)
  assert.equal(element.props.type, 'button')
  const busy = render(Button, { loading: true, type: 'submit', children: 'Guardar', loadingLabel: 'Guardando queja' })
  assert.match(busy, /type="submit"/)
  assert.match(busy, /disabled=""/)
  assert.match(busy, /aria-busy="true"/)
  assert.match(busy, /role="status"[^>]*>Guardando queja/)
  assert.doesNotMatch(busy, /class="[^"]*\b(?:btn|spinner-border)\b/)
  assert.match(render(Button, { disabled: true, children: 'Guardar' }), /disabled=""/)
})

test('Input y Field enlazan nombre y ayuda sin descartar props nativas', () => {
  const { default: Input } = loadModule('components/ui/Input.tsx')
  const { default: Field } = loadModule('components/ui/Field.tsx')
  const onChange = () => {}
  const ref = { current: null }
  const input = Input({ id: 'email', name: 'email', type: 'email', required: true,
    'aria-invalid': true, 'aria-describedby': 'email-hint', size: 30, onChange, ref })
  assert.equal(input.props.onChange, onChange)
  assert.equal(input.props.ref, ref)
  const html = render(Field, { id: 'email', label: 'Correo', hint: 'Correo de acceso', children: input })
  assert.match(html, /name="email"/)
  assert.match(html, /required=""/)
  assert.match(html, /aria-describedby="email-hint"/)
  assert.match(html, /id="email-hint"/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /size="30"/)
  assert.match(html, /for="email"/)
})

test('Badge transmite atributos y usa variantes semánticas del kit activo', () => {
  const { default: Badge } = loadModule('components/ui/Badge.tsx')
  const html = render(Badge, { variant: 'green', title: 'Estado', 'aria-label': 'Queja resuelta', children: 'Resuelto' })
  assert.match(html, /title="Estado"/)
  assert.match(html, /aria-label="Queja resuelta"/)
  assert.match(html, /bg-qms-success/)
  assert.doesNotMatch(html, /tw:/)
})

test('PostCSS compila una única entrada con los tokens de marca y un solo Preflight', async () => {
  const entry = path.resolve('app/globals.css')
  const result = await postcss([tailwind({ optimize: false })]).process(fs.readFileSync(entry, 'utf8'), { from: entry })
  const styles = postcss.parse(result.css)
  let resets = 0
  styles.walkRules(rule => {
    if (rule.selector.replace(/\s+/g, ' ').trim() === 'button, input, select, optgroup, textarea, ::file-selector-button') resets++
  })
  assert.equal(resets, 1)
  assert.match(result.css, /--color-qms-primary:\s*#024796/)
  assert.match(result.css, /--color-qms-dark:\s*#212529/)
  assert.match(result.css, /--radius-button:\s*0\.25rem/)
  assert.match(result.css, /\.ui-field\b/)
  assert.match(result.css, /\.ui-button-primary\b/)
  assert.doesNotMatch(result.css, /\.tw\\:/)
})
