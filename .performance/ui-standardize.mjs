import fs from 'node:fs'
import ts from 'typescript'
import { businessSignatures } from '../scripts/audit-ui-migration.mjs'

const files = []
function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${item.name}`
    if (file === 'components/ui/tailwind' || file === 'components/header') continue
    if (item.isDirectory()) scan(file)
    else if (file.endsWith('.tsx') && !['components/Sidebar.tsx', 'components/Header.tsx', 'components/Modal.tsx'].includes(file) && !file.startsWith('components/ui/')) files.push(file)
  }
}
scan('app'); scan('components')
let buttons = 0, fields = 0
const changed = []
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = []
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      const attributes = node.attributes.properties
      const attr = attributes.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.text === 'className')
      if (attr?.initializer && ts.isStringLiteral(attr.initializer)) {
        const classes = attr.initializer.text.split(/\s+/).filter(Boolean)
        let replacement
        if (tag === 'button' && !classes.some(token => token.startsWith('ui-button') || token.startsWith('tw:'))) {
          const variant = classes.some(token => ['bg-qms-primary', 'bg-blue-600'].includes(token)) ? 'primary'
            : classes.some(token => ['text-red-600', 'text-qms-danger', 'bg-qms-danger'].includes(token)) ? 'danger'
              : classes.some(token => ['text-blue-600', 'text-qms-primary'].includes(token)) ? 'link'
                : classes.includes('bg-transparent') && !classes.some(token => token.startsWith('text-white')) ? 'ghost' : null
          if (variant) {
            const size = classes.some(token => /^h-(10|11|\[38px\])$/.test(token)) ? '' : 'ui-button-sm'
            const keep = classes.filter(token => !/^(rounded|border|bg-|font-|text-(xs|sm|base|white|gray|blue|red|qms)|hover:(bg|text|border)|transition|p[xy]?-[^\s]+$|focus:)/.test(token))
            replacement = ['ui-button', `ui-button-${variant}`, size, ...keep].filter(Boolean).join(' ')
            buttons++
          }
        } else if (['input', 'textarea'].includes(tag) && classes.some(token => /^border(?:-|$)/.test(token)) && !classes.some(token => token.startsWith('tw:') || token.startsWith('ui-'))) {
          const type = attributes.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.text === 'type')?.initializer
          if (!(type && ts.isStringLiteral(type) && ['checkbox', 'radio', 'file', 'hidden', 'range'].includes(type.text))) {
            const keep = classes.filter(token => !/^(rounded|border(?:-|$)|bg-white$|bg-qms-surface$|text-(gray|qms)|focus:|outline-none$)/.test(token))
            replacement = [tag === 'textarea' ? 'ui-textarea' : 'ui-field', ...keep].join(' ')
            fields++
          }
        }
        if (replacement) edits.push({ start: attr.initializer.getStart(source), end: attr.initializer.end, replacement: JSON.stringify(replacement) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!edits.length) continue
  let output = text
  for (const edit of edits.sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end)
  const before = businessSignatures(file, text), after = businessSignatures(file, output)
  if (before.hooks !== after.hooks || before.events !== after.events) throw new Error(`La receta alteró eventos: ${file}`)
  fs.writeFileSync(file, output)
  changed.push(file)
}
console.log(JSON.stringify({ buttons, fields, changed }, null, 2))
