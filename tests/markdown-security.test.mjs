import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import ts from 'typescript'
import { loadModule } from './load-module.mjs'

// El panel usa el lector canónico desde la integración de Tiptap; probar esa
// frontera evita exigir un renderer inline que ya no forma parte de la vista.
test('el análisis usa el lector seguro sin HTML ni recursos externos', async () => {
  const source = await readFile(new URL('../app/mis-quejas/components/QuejaColaboradorPanel.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('panel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const renderers = []
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === 'RichTextContent') renderers.push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(renderers.length > 0)
  assert.match(source, /import RichTextContent from '@\/components\/ui\/RichTextContent'/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|<ReactMarkdown/)
  const { default: Reader } = loadModule('components/ui/RichTextContent.tsx')
  const html = renderToStaticMarkup(React.createElement(Reader, { format: 'markdown', value: '**Conclusión**\n\n<script>alert(1)</script>\n\n[Referencia](https://example.test)\n\n![imagen](https://example.test/track.png)' }))
  assert.match(html, /<strong>Conclusión<\/strong>/)
  assert.doesNotMatch(html, /<(?:script|img|iframe|a)\b|\b(?:src|href)=/i)
})

function render(markdown) {
  return renderToStaticMarkup(React.createElement(Markdown, {
    components: {
      a: ({ href, children }) => React.createElement('a', { href, target: '_blank', rel: 'noopener noreferrer' }, children),
    },
  }, markdown))
}

test('HTML y atributos ejecutables se muestran como texto, sin nodos activos', () => {
  const html = render('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">')
  assert.ok(!html.includes('<script'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('enlaces y recursos Markdown no reciben esquemas ejecutables', () => {
  for (const markdown of ['[enlace](javascript:alert%281%29)', '[enlace](data:text/html,test)', '![imagen](javascript:alert%281%29)']) {
    const html = render(markdown)
    assert.ok(!/\b(?:href|src)="(?:javascript|data):/i.test(html))
  }
})

test('HTTPS y formato útil del análisis se conservan con enlaces aislados', () => {
  const html = render('**Conclusión**\n\n[Referencia](https://example.test/documento)')
  assert.ok(html.includes('<strong>Conclusión</strong>'))
  assert.ok(html.includes('href="https://example.test/documento"'))
  assert.ok(html.includes('target="_blank"'))
  assert.ok(html.includes('rel="noopener noreferrer"'))
})
