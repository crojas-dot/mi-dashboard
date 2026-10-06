import fs from 'node:fs'
import { businessSignatures } from '../scripts/audit-ui-migration.mjs'

const aliases = { 'bg-blue-50': 'bg-qms-primary-soft', 'text-blue-600': 'text-qms-primary', 'bg-blue-600': 'bg-qms-primary', 'border-blue-600': 'border-qms-primary', 'ring-blue-600': 'ring-qms-primary', 'text-blue-700': 'text-qms-primary-hover', 'bg-blue-700': 'bg-qms-primary-hover', 'border-blue-700': 'border-qms-primary-hover', 'text-blue-800': 'text-qms-primary-dark', 'bg-blue-800': 'bg-qms-primary-dark' }
const pattern = /\b(?:bg|text|border|ring)-blue-(?:50|600|700|800)\b(?!\/)/g
let changed = 0
function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${item.name}`
    if (file === 'components/ui/tailwind') continue
    if (item.isDirectory()) scan(file)
    else if (file.endsWith('.tsx')) {
      const before = fs.readFileSync(file, 'utf8')
      if (before.includes('tw:')) continue
      const after = before.replace(pattern, token => aliases[token] ?? token)
      if (after === before) continue
      const a = businessSignatures(file, before), b = businessSignatures(file, after)
      if (a.hooks !== b.hooks || a.events !== b.events) throw new Error(`Cambió un evento: ${file}`)
      fs.writeFileSync(file, after)
      changed++
    }
  }
}
scan('app'); scan('components')
console.log(`Acentos de marca centralizados en ${changed} archivos.`)
