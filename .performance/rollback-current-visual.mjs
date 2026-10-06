import fs from 'node:fs'
const before = JSON.parse(fs.readFileSync('.performance/current-visual-before.json', 'utf8'))
const files = [
  'app/configuracion/components/ModoVistaActiva.tsx',
  'app/configuracion/components/RolesAccesos.tsx',
  'app/configuracion/page.tsx',
  'app/mis-quejas/page.tsx',
  'app/page.tsx',
  'app/quejas/page.tsx',
  'app/reporteria/components/GeneradorInformeModal.tsx',
  'components/AuthenticatedLayout.tsx',
  'components/configuracion/AIProvidersManager.tsx',
  'components/dashboard/GeneralTab.tsx',
  'components/Modal.tsx',
  'components/Sidebar.tsx',
  'components/StatCard.tsx',
  'components/ui/Badge.tsx',
  'components/ui/Button.tsx',
  'components/ui/PageHeader.tsx',
  'components/ui/Select.tsx',
  'components/ui/Table.tsx',
]
for (const file of files) {
  if (typeof before[file] !== 'string') throw new Error(`Missing original: ${file}`)
}
for (const file of files) fs.writeFileSync(file, before[file])
fs.copyFileSync('.performance/current-globals-before.css', 'app/globals.css')
const eslint = 'eslint.config.mjs'
fs.writeFileSync(eslint, fs.readFileSync(eslint, 'utf8').replace(/    \/\/ Local previews and snapshots are generated artifacts, not application code\.\r?\n    "\.performance\/\*\*",\r?\n    "\.experiments\/\*\*",\r?\n    "\.ref-template\/\*\*",\r?\n/, ''))
const ignore = '.gitignore'
fs.writeFileSync(ignore, fs.readFileSync(ignore, 'utf8').replace(/(# misc\r?\n)\.performance\/\r?\n\.experiments\/\r?\n\.ref-template\/\r?\n/, '$1'))
for (const file of files) if (fs.readFileSync(file, 'utf8') !== before[file]) throw new Error(`Restore failed: ${file}`)
if (!fs.readFileSync('app/globals.css').equals(fs.readFileSync('.performance/current-globals-before.css'))) throw new Error('CSS restore failed')
console.log('Restored and verified 18 source files, globals.css and the two configuration edits.')
