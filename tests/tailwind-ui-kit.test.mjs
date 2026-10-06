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

test('el kit resuelve overrides tw: sin confundir color, tamaño y modificadores', () => {
  const { cn } = loadModule('components/ui/tailwind/cn.ts')
  assert.equal(cn('tw:px-3 tw:text-base tw:text-primary tw:hover:bg-primary', {
    'tw:px-6 tw:text-sm tw:text-danger tw:hover:bg-danger': true,
    'tw:hidden': false,
  }), 'tw:px-6 tw:text-sm tw:text-danger tw:hover:bg-danger')
  assert.equal(cn('tw:p-4', 'tw:p-0'), 'tw:p-0')
})

test('Button conserva atributos, ref y eventos; loading bloquea envíos y anuncia estado', () => {
  const { default: Button } = loadModule('components/ui/tailwind/Button.tsx')
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

test('Input y Label enlazan nombre y error sin descartar props nativas', () => {
  const { default: Input } = loadModule('components/ui/tailwind/Input.tsx')
  const { default: Label } = loadModule('components/ui/tailwind/Label.tsx')
  const onChange = () => {}
  const ref = { current: null }
  const element = Input({ id: 'email', name: 'email', type: 'email', required: true,
    'aria-invalid': true, 'aria-describedby': 'email-error', htmlSize: 30, onChange, ref })
  assert.equal(element.props.onChange, onChange)
  assert.equal(element.props.ref, ref)
  const html = renderToStaticMarkup(element)
  assert.match(html, /name="email"/)
  assert.match(html, /required=""/)
  assert.match(html, /aria-describedby="email-error"/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /size="30"/)
  assert.match(render(Label, { htmlFor: 'email', children: 'Correo' }), /for="email"/)
})

test('Card compuesto y Badge transmiten atributos sin clases CoreUI', () => {
  const { Card, CardHeader, CardContent, CardFooter } = loadModule('components/ui/tailwind/Card.tsx')
  const { Badge } = loadModule('components/ui/tailwind/Badge.tsx')
  const html = render(Card, { 'aria-labelledby': 'card-heading', children: [
    createElement(CardHeader, { key: 'header' }, createElement('h2', { id: 'card-heading' }, 'Quejas')),
    createElement(CardContent, { key: 'content', className: 'tw:p-0' }, createElement(Badge, { variant: 'success', title: 'Estado' }, 'Resuelto')),
    createElement(CardFooter, { key: 'footer' }, 'Acciones'),
  ] })
  assert.match(html, /aria-labelledby="card-heading"/)
  assert.match(html, /class="tw:p-0"/)
  assert.match(html, /title="Estado"/)
  assert.match(html, /tw:text-green-800/)
  assert.doesNotMatch(html, /class="(?:card|badge)\b/)
})

test('PostCSS publica los tokens y un único Preflight en la entrada consolidada', async () => {
  const kitPath = path.resolve('app/styles/ui-kit.css')
  const compile = (filename) => postcss([tailwind({ optimize: false })]).process(fs.readFileSync(filename, 'utf8'), { from: filename })
  const kit = await compile(kitPath)
  const styles = postcss.parse(kit.css)
  const rules = new Map()
  styles.walkRules((rule) => rules.set(rule.selector, rule))
  const padding = rules.get('.tw\\:p-4')
  assert.ok(padding, 'falta la utilidad con prefijo')
  assert.equal(padding.nodes.find((node) => node.prop === 'padding')?.value, 'calc(var(--tw-spacing) * 4)')
  assert.ok(rules.get('.tw\\:bg-primary'))
  assert.ok(rules.get('.tw\\:font-sans'))
  assert.ok(rules.has('button, input, select, optgroup, textarea, ::file-selector-button'), 'falta el único reset de Tailwind')
  const legacy = await compile(path.resolve('app/globals.css'))
  assert.match(legacy.css, /--color-qms-primary:\s*#3b82f6/)
  assert.match(legacy.css, /--color-qms-dark:\s*#111827/)
  assert.match(legacy.css, /--radius-qms-control:\s*0\.375rem/)
})