import fs from 'node:fs'
import { businessSignatures } from '../scripts/audit-ui-migration.mjs'
const original = JSON.parse(fs.readFileSync('.performance/step4-batch1-before.json', 'utf8'))
fs.writeFileSync('tests/fixtures/step4-batch1-business.json', JSON.stringify(Object.fromEntries(Object.entries(original).map(([file, text]) => [file, businessSignatures(file, text)])), null, 2))
for (const file of Object.keys(original)) {
  let text = fs.readFileSync(file, 'utf8')
  text = text.replace(/className="([^"]*)"/g, (_, classes) => `className="${classes.trim().replace(/\s+/g, ' ')}"`).replace(/\n{3,}/g, '\n\n')
  if (file.includes('/components/')) text = text.replaceAll('tw:grid tw:grid-cols-2 tw:gap-6', 'tw:grid tw:grid-cols-1 tw:gap-6 tw:sm:grid-cols-2')
  fs.writeFileSync(file, text)
}
