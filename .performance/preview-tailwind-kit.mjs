import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from '../tests/load-module.mjs'

const { Button } = loadModule('components/ui/tailwind/Button.tsx')
const { Card, CardHeader, CardContent, CardFooter } = loadModule('components/ui/tailwind/Card.tsx')
const { Badge } = loadModule('components/ui/tailwind/Badge.tsx')
const { Input } = loadModule('components/ui/tailwind/Input.tsx')
const { Label } = loadModule('components/ui/tailwind/Label.tsx')
const compile = async (file) => (await postcss([tailwind({ optimize: false })]).process(
  fs.readFileSync(file, 'utf8') + (file.endsWith('ui-kit.css') ? '\n@source "../../.performance/preview-tailwind-kit.mjs";' : ''),
  { from: path.resolve(file) },
)).css
const css = (await compile('app/globals.css')) + (await compile('app/styles/ui-kit.css'))
const example = (scope, id) => h('section', { className: scope ? 'coreui-scope' : '', key: id },
  h(Card, { 'data-scope': id, 'aria-labelledby': `${id}-title` },
    h(CardHeader, null, h('h2', { id: `${id}-title`, className: 'tw:m-0 tw:text-base tw:font-semibold' }, scope ? 'Kit dentro de CoreUI' : 'Kit independiente'), h(Badge, { variant: 'success' }, 'Resuelto')),
    h(CardContent, { 'data-padding': id },
      h('div', { className: 'tw:grid tw:gap-2' }, h(Label, { htmlFor: `${id}-input` }, 'Persona o empresa'), h(Input, { id: `${id}-input`, name: 'cliente', defaultValue: 'Ente Costarricense de Acreditación' })),
      h('div', { className: 'tw:flex tw:flex-wrap tw:gap-2 tw:py-3' }, ...['primary', 'secondary', 'danger', 'ghost'].map(variant => h(Button, { key: variant, variant, 'data-variant': variant }, variant))),
      h('div', { className: 'tw:flex tw:flex-wrap tw:gap-2' }, h(Button, { loading: true }, 'Guardando'), h(Button, { disabled: true }, 'Deshabilitado')),
    ),
    h(CardFooter, null, h(Badge, { variant: 'warning' }, 'Pendiente'), h(Button, { size: 'sm', variant: 'secondary' }, 'Ver detalle')),
  ),
)
const content = renderToStaticMarkup(h('main', { className: 'tw:mx-auto tw:max-w-4xl tw:space-y-4 tw:p-4' }, example(false, 'standalone'), example(true, 'legacy')))
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verificación aislada del kit</title><style>${css}</style></head><body>${content}</body></html>`
fs.writeFileSync('.performance/tailwind-kit-preview.html', html)
http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html) }).listen(3011, '127.0.0.1', () => console.log('UI kit preview http://localhost:3011'))
