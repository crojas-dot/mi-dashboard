import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import ts from 'typescript'
import postcss from 'postcss'

const modules = ['procesos', 'auditorias', 'riesgos', 'revision', 'documentos']
const forms = ['NuevoProcesoModal', 'NuevaAuditoriaModal', 'NuevoRiesgoModal', 'NuevaReunionModal', 'NuevoDocumentoModal']
const files = modules.flatMap((name, i) => [`app/${name}/page.tsx`, `app/${name}/components/${forms[i]}.tsx`])
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const printer = ts.createPrinter({ removeComments: true })
const hash = text => crypto.createHash('sha256').update(text).digest('hex')

function signatures(file, text) {
  const source = parse(file, text), hooks = [], events = [], declarations = []
  const print = node => printer.printNode(ts.EmitHint.Unspecified, node, source)
  function walk(node) {
    if (ts.isCallExpression(node) && /^(?:React\.)?use[A-Z]/.test(node.expression.getText(source))) hooks.push(print(node))
    if (ts.isJsxAttribute(node) && /^on[A-Z]/.test(node.name.text)) events.push(print(node))
    if (ts.isFunctionDeclaration(node) && node.body) {
      declarations.push(...node.body.statements.filter(statement => !ts.isReturnStatement(statement)).map(print))
    }
    ts.forEachChild(node, walk)
  }
  walk(source)
  return { hooks: hash(hooks.join('\n')), events: hash(events.join('\n')), business: hash(declarations.join('\n')) }
}

const all = []
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`
    if (entry.isDirectory()) scan(file)
    else if (/\.(tsx|jsx)$/.test(file)) {
      const text = fs.readFileSync(file, 'utf8')
      if (/@coreui\/(react|icons)/.test(text) || /className=["'`][^"'`]*(?:\bcard\b|\bbtn\b|\bcontainer\b|\bd-flex\b|\bform-control\b|\btable-responsive\b)/.test(text)) all.push(file)
    }
  }
}
scan('app'); scan('components')
fs.writeFileSync('.performance/step4-scan.json', JSON.stringify({ scanned: ['app', 'components'], candidates: all, batch: files }, null, 2))
const originals = Object.fromEntries(files.map(file => [file, fs.readFileSync(file, 'utf8')]))
fs.writeFileSync('.performance/step4-batch1-before.json', JSON.stringify(originals))
fs.mkdirSync('tests/fixtures', { recursive: true })
fs.writeFileSync('tests/fixtures/step4-batch1-business.json', JSON.stringify(Object.fromEntries(files.map(file => [file, signatures(file, originals[file])])), null, 2))

// Resolver los espaciados que Bootstrap imponía con !important: p-4=24px,
// gap-3=16px, etc. Mantener el tamaño visible con la escala Tailwind de 4px.
const spacing = new Map()
postcss.parse(fs.readFileSync('app/coreui-scoped.css', 'utf8')).walkRules(rule => {
  const match = rule.selector.match(/^:where\(\.coreui-scope\) \.((?:[mp][xytblrse]?|gap)-[0-5])$/)
  if (!match) return
  const declaration = rule.nodes.find(node => node.type === 'decl' && node.important && /(?:margin|padding|gap)/.test(node.prop))
  if (!declaration) return
  const amount = declaration.value === '0' ? 0 : Number.parseFloat(declaration.value) * 4
  if (!Number.isFinite(amount)) return
  spacing.set(match[1], `${match[1].split('-')[0]}-${amount}`)
})
const replacements = {
  'coreui-module': 'font-sans text-foreground', 'rounded-card': 'rounded-lg', 'rounded': 'rounded-md',
  'text-qms-dark': 'text-foreground', 'text-qms-muted': 'text-muted', 'bg-qms-surface': 'bg-surface',
  'bg-qms-primary': 'bg-primary', 'border-qms-border': 'border-border',
  'text-gray-900': 'text-foreground', 'text-gray-600': 'text-muted', 'text-gray-500': 'text-muted',
  'bg-soft-green-bg': 'bg-green-50', 'text-soft-green-text': 'text-green-800',
  'bg-soft-amber-bg': 'bg-amber-50', 'text-soft-amber-text': 'text-amber-900',
  'bg-soft-red-bg': 'bg-red-50', 'text-soft-red-text': 'text-red-800',
  'text-sm': 'text-base', 'text-xs': 'text-sm', 'text-[10px]': 'text-sm',
}
const classes = text => text.replace(/\S+/g, token => {
  if (token.startsWith('tw:')) return token
  // El panel conserva su tema claro; las variantes dark huérfanas no definen un tema.
  if (token.startsWith('dark:')) return ''
  const value = replacements[token] ?? spacing.get(token) ?? token
  return value.split(' ').map(value => `tw:${value}`).join(' ')
})
const tags = { CTableRow: 'tr', CTableBody: 'tbody', CCard: 'Card', CFormLabel: 'Label', CFormInput: 'Input', CFormTextarea: 'Textarea' }
for (const file of files) {
  const source = parse(file, originals[file]), edits = [], imports = new Set()
  const edit = (start, end, text) => edits.push({ start, end, text })
  function inClass(node) {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxAttribute(parent)) return parent.name.text === 'className'
      if (ts.isVariableDeclaration(parent)) return parent.name.getText(source) === 'matrizCellClass'
    }
    return false
  }
  function walk(node) {
    if (ts.isImportDeclaration(node)) {
      const value = node.moduleSpecifier.text
      if (value === '@coreui/react') edit(node.getStart(source), node.end, '')
      else if (value === '@/components/ui/icons') {
        edit(node.moduleSpecifier.getStart(source), node.moduleSpecifier.end, "'lucide-react'")
      } else if (/^@\/components\/ui\/(ErrorState|Pagination|Table|Badge|EmptyState|Button|Select)$/.test(value)) {
        edit(node.moduleSpecifier.getStart(source), node.moduleSpecifier.end, `'${value.replace('/ui/', '/ui/tailwind/')}'`)
      } else if (value === '@/components/Modal') edit(node.moduleSpecifier.getStart(source), node.moduleSpecifier.end, "'@/components/ui/tailwind/Modal'")
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxClosingElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      if (tags[tag]) {
        edit(node.tagName.getStart(source), node.tagName.end, tags[tag])
        if (!['tr', 'tbody'].includes(tags[tag])) imports.add(tags[tag])
      }
    }
    if (inClass(node)) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) edit(node.getStart(source) + 1, node.end - 1, classes(node.text))
      else if ([ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(node.kind)) edit(node.getStart(source) + 1, node.end - (node.kind === ts.SyntaxKind.TemplateTail ? 1 : 2), classes(node.text))
    }
    ts.forEachChild(node, walk)
  }
  walk(source)
  let text = originals[file]
  for (const { start, end, text: replacement } of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, start) + replacement + text.slice(end)
  text = text.replace("'use client'", "'use client'\n\n" + [...imports].map(name => `import ${name} from '@/components/ui/tailwind/${name}'`).join('\n'))

  // Labels y controles conservan value/onChange; agregar solo enlaces accesibles.
  const updated = parse(file, text), attributes = []
  const prefix = file.split('/')[1]
  const attr = (node, name) => node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.text === name)
  function labels(node) {
    if (ts.isJsxElement(node)) {
      const label = node.children.find(child => ts.isJsxElement(child) && child.openingElement.tagName.getText(updated) === 'Label')
      const control = node.children.find(child => (ts.isJsxSelfClosingElement(child) && ['Input', 'Textarea'].includes(child.tagName.getText(updated))) || (ts.isJsxElement(child) && child.openingElement.tagName.getText(updated) === 'Select'))
      if (label && control) {
        const opening = ts.isJsxElement(control) ? control.openingElement : control
        const value = attr(opening, 'value')?.initializer?.getText(updated) ?? ''
        const field = value.match(/form\.([a-z_]+)/)?.[1] ?? `field-${label.pos}`
        const id = `${prefix}-${field}`
        if (!attr(opening, 'id')) attributes.push({ pos: opening.tagName.end, text: ` id="${id}"` })
        if (!attr(label.openingElement, 'htmlFor')) attributes.push({ pos: label.openingElement.tagName.end, text: ` htmlFor="${id}"` })
      }
    }
    ts.forEachChild(node, labels)
  }
  labels(updated)
  for (const change of attributes.sort((a, b) => b.pos - a.pos)) text = text.slice(0, change.pos) + change.text + text.slice(change.pos)
  const before = signatures(file, originals[file]), after = signatures(file, text)
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`Business changed: ${file}`)
  fs.writeFileSync(file, text)
}
console.log(JSON.stringify({ candidates: all.length, migrated: files, businessSignatures: 'unchanged' }, null, 2))
