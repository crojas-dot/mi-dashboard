import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import ts from 'typescript'

// The active renderer keeps react-markdown's URL filter and HTML escaping.
// Plugins or URL overrides require a separate security review before use here.
test('el análisis mantiene el filtro de URLs y no habilita HTML crudo', async () => {
  const source = await readFile(new URL('../app/mis-quejas/components/QuejaColaboradorPanel.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('panel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const renderers = []
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === 'ReactMarkdown') renderers.push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(renderers.length, 1)
  const attributes = renderers[0].attributes.properties
  assert.ok(attributes.every((attribute) => ts.isJsxAttribute(attribute)), 'No aceptar props Markdown sin revisar')
  const names = attributes.map((attribute) => attribute.name.getText(ast))
  for (const option of ['urlTransform', 'remarkPlugins', 'rehypePlugins', 'remarkRehypeOptions']) {
    assert.ok(!names.includes(option), `${option} requiere una revisión específica de seguridad`)
  }
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
