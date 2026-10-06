import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import ts from 'typescript'
import { pathToFileURL } from 'node:url'

const printer = ts.createPrinter({ removeComments: true })
const hash = values => crypto.createHash('sha256').update(values.join('\n')).digest('hex')
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

/** Huellas de contratos de negocio antes/después de una migración solo visual. */
export function businessSignatures(file, text) {
  const source = parse(file, text), hooks = [], events = [], declarations = []
  const print = node => printer.printNode(ts.EmitHint.Unspecified, node, source)
  const hasJSX = node => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true
    return ts.forEachChild(node, hasJSX) ?? false
  }
  for (const node of source.statements) {
    if (ts.isImportDeclaration(node)) continue
    if (ts.isFunctionDeclaration(node) && node.body) declarations.push(...node.body.statements.filter(statement => !hasJSX(statement)).map(print))
    else if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'matrizCellClass')) continue
    else declarations.push(print(node))
  }
  function walk(node) {
    if (ts.isCallExpression(node) && /^(?:React\.)?use[A-Z]/.test(node.expression.getText(source))) hooks.push(print(node))
    if (ts.isJsxAttribute(node) && /^on[A-Z]/.test(node.name.text)) events.push(print(node))
    ts.forEachChild(node, walk)
  }
  walk(source)
  return { hooks: hash(hooks), events: hash(events), business: hash(declarations) }
}

export function scanVisualImports() {
  const files = []
  // Auditar la entrada CSS real: los prototipos no definen el prefijo del panel.
  const entryCss = fs.readFileSync('app/globals.css', 'utf8')
  const prefixed = /@import\s+["']tailwindcss["'][^;]*prefix\(tw\)/.test(entryCss)
  const bootstrapClass = /^(?:btn(?:-|$)|form-control$|form-select$|input-group(?:-|$)|nav-link$|dropdown-menu$|spinner-border$|modal-dialog$)/
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`
      if (entry.isDirectory()) scan(file)
      else if (/\.(tsx|jsx)$/.test(file)) {
        const text = fs.readFileSync(file, 'utf8'), source = parse(file, text)
        const coreui = [], classes = new Set(), cssModules = []
        function walk(node) {
          if (ts.isImportDeclaration(node)) {
            if (node.moduleSpecifier.text.startsWith('@coreui/')) coreui.push(node.moduleSpecifier.text)
            if (node.moduleSpecifier.text.endsWith('.module.css')) cssModules.push(node.moduleSpecifier.text)
          }
          if (ts.isJsxAttribute(node) && ['className', 'classNames'].includes(node.name.text)) {
            function literals(child) {
              // Conditions select classes; their state/size literals are not CSS.
              if (ts.isBinaryExpression(child) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(child.operatorToken.kind)) return
              if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child) || [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(child.kind)) {
                for (const value of child.text.split(/\s+/).filter(Boolean)) {
                  if (prefixed ? !value.startsWith('tw:') : bootstrapClass.test(value)) classes.add(value)
                }
              }
              ts.forEachChild(child, literals)
            }
            literals(node)
          }
          ts.forEachChild(node, walk)
        }
        walk(source)
        files.push({ file, coreui, unprefixedClasses: [...classes], cssModules })
      }
    }
  }
  for (const dir of ['app', 'components', 'lib', 'hooks']) if (fs.existsSync(dir)) scan(dir)
  return files
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href) {
  const baseline = JSON.parse(fs.readFileSync('tests/fixtures/step4-batch1-business.json', 'utf8'))
  for (const [file, expected] of Object.entries(baseline)) {
    const current = businessSignatures(file, fs.readFileSync(file, 'utf8'))
    if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error(`Cambió la lógica del lote visual: ${file}`)
  }
  const inventory = scanVisualImports()
  fs.mkdirSync('.performance', { recursive: true })
  fs.writeFileSync('.performance/step4-remaining.json', JSON.stringify(inventory, null, 2))
  console.log(JSON.stringify({ verifiedFiles: Object.keys(baseline).length, scanned: inventory.length, remainingCoreUI: inventory.filter(file => file.coreui.length).length, remainingUnprefixedClasses: inventory.filter(file => file.unprefixedClasses.length || file.cssModules.length).length }, null, 2))
}
