import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { scanVisualImports } from '../scripts/audit-ui-migration.mjs'

test('todo el panel usa componentes locales y utilidades Tailwind sin CSS Modules ni CoreUI', () => {
  const violations = scanVisualImports().filter(file => file.coreui.length || file.unprefixedClasses.length || file.cssModules.length)
  assert.deepEqual(violations, [])
  const dependencies = JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies
  assert.ok(!Object.keys(dependencies).some(name => name.startsWith('@coreui/') || name === 'bootstrap'))
})

test('tablas de quejas conservan HTML nativo y contención de scroll', () => {
  for (const file of ['app/quejas/page.tsx', 'app/mis-quejas/page.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /<table\b/)
    // La contención de scroll está en el componente Table (tw:[contain:paint] tw:overscroll-contain)
    // o en el CSS Module del wrapper (quejas.styles / mis-quejas.styles)
    assert.doesNotMatch(source, /<CTable\b/)
  }
})
