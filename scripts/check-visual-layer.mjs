import fs from 'node:fs'
import { scanVisualImports, businessSignatures } from './audit-ui-migration.mjs'

// Read-only regression guard. Run after a visual edit; no generated CSS or DB access.
const inventory = scanVisualImports()
const errors = []
for (const file of inventory) {
  if (file.coreui.length || file.unprefixedClasses.length || file.cssModules.length) errors.push(file)
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
if (Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some(name => name.startsWith('@coreui/') || name === 'bootstrap')) errors.push('Legacy UI dependency')
for (const file of ['app/coreui-scoped.css', 'app/styles/coreui-bridge.css']) if (fs.existsSync(file)) errors.push(`Legacy CSS: ${file}`)
// Hook/event hashes record the pre-migration behavior. Refresh this fixture only
// when a business change is intentional and reviewed, never to conceal drift.
if (process.argv.includes('--business')) {
  const baseline = JSON.parse(fs.readFileSync('tests/fixtures/tailwind-final-business.json', 'utf8'))
  for (const [file, expected] of Object.entries(baseline)) {
    const actual = businessSignatures(file, fs.readFileSync(file, 'utf8'))
    if (expected.hooks !== actual.hooks || expected.events !== actual.events) errors.push(`Business contract changed: ${file}`)
  }
}
if (errors.length) throw new Error(JSON.stringify(errors, null, 2))
console.log(`Visual layer verified: ${inventory.length} React files, no legacy imports/classes/CSS Modules.`)
