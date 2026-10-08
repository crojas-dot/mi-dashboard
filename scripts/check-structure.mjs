import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// Static inventory: source/configuration only, never .env, DB data, benchmark
// artifacts or network. Unmounted code needs review before any deletion.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoots = ['app', 'components', 'lib', 'hooks']
const sourceExtensions = /\.(?:[cm]?[jt]sx?|css)$/
const moduleExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css']
const normalized = value => value.split(path.sep).join('/')
const relative = value => normalized(path.relative(root, value))
const exists = value => fs.existsSync(value) && fs.statSync(value).isFile()
const read = value => fs.readFileSync(path.join(root, value), 'utf8').replace(/^\uFEFF/, '')
const failures = []

function filesIn(directory) {
  const absolute = path.join(root, directory)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const file = directory + '/' + entry.name
    // Never follow symlinks into private local data or outside the repository.
    if (entry.isSymbolicLink()) return []
    return entry.isDirectory() ? filesIn(file) : [file]
  })
}

// Comments and strings are separated before locating literal imports. This
// lexer does not evaluate computed imports or execute application code.
function tokens(text) {
  const result = []
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (/\s/.test(char)) { index++; continue }
    if (text.startsWith('//', index)) {
      index = text.indexOf('\n', index + 2)
      if (index < 0) break
      continue
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2)
      index = end < 0 ? text.length : end + 2
      continue
    }
    if (char === '"' || char === "'" || char === '\x60') {
      const quote = char
      let value = '', computed = false
      index++
      while (index < text.length && text[index] !== quote) {
        if (text[index] === '\\') {
          value += text[index + 1] ?? ''
          index += 2
        } else {
          if (quote === '\x60' && text.startsWith('$' + '{', index)) computed = true
          value += text[index++]
        }
      }
      index++
      result.push({ kind: computed ? 'template' : 'string', value })
      continue
    }
    const identifier = /^[A-Za-z_$][\w$]*/.exec(text.slice(index))
    if (identifier) {
      result.push({ kind: 'word', value: identifier[0] })
      index += identifier[0].length
      continue
    }
    result.push({ kind: 'punctuation', value: char })
    index++
  }
  return result
}

function importsIn(file, text) {
  if (file.endsWith('.css')) {
    const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '')
    return [...withoutComments.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)].map(match => match[1])
  }
  const stream = tokens(text), imports = []
  for (let index = 0; index < stream.length; index++) {
    const token = stream[index]
    if (token.kind !== 'word') continue
    const next = stream[index + 1]
    if (['import', 'require'].includes(token.value) && next?.value === '(') {
      if (stream[index + 2]?.kind === 'string') imports.push(stream[index + 2].value)
      continue
    }
    if (token.value === 'import' && next?.kind === 'string') {
      imports.push(next.value)
      continue
    }
    if (token.value !== 'import' && !(token.value === 'export' && ['{', '*', 'type'].includes(next?.value))) continue
    if (next?.value === '.') continue
    for (let cursor = index + 1; cursor < stream.length; cursor++) {
      const current = stream[cursor]
      if (current.value === ';' || ['import', 'export'].includes(current.value)) break
      if (current.value === 'from' && stream[cursor + 1]?.kind === 'string') {
        imports.push(stream[cursor + 1].value)
        break
      }
    }
  }
  return [...new Set(imports)]
}

function resolveLocal(file, specifier) {
  if (!(specifier.startsWith('@/') || specifier.startsWith('.'))) return null
  const clean = specifier.split(/[?#]/)[0]
  const base = specifier.startsWith('@/') ? path.join(root, clean.slice(2)) : path.resolve(root, path.dirname(file), clean)
  if (!base.startsWith(root + path.sep)) return { error: 'outside repository' }
  const candidates = [base, ...moduleExtensions.map(extension => base + extension), ...moduleExtensions.map(extension => path.join(base, 'index' + extension))]
  // Bundler resolution permits a .js import to point to TypeScript source.
  if (/\.[cm]?js$/.test(base)) candidates.push(...['.ts', '.tsx', '.mts', '.cts'].map(extension => base.replace(/\.[cm]?js$/, extension)))
  const found = candidates.find(exists)
  return found ? { file: relative(found) } : { error: 'missing target' }
}

const sourceFiles = sourceRoots.flatMap(filesIn).filter(file => sourceExtensions.test(file))
for (const file of ['proxy.ts', 'proxy.js', 'instrumentation.ts', 'instrumentation.js', 'instrumentation-client.ts', 'instrumentation-client.js']) {
  if (exists(path.join(root, file))) sourceFiles.push(file)
}
const graph = new Map()
for (const file of sourceFiles) {
  const edges = []
  for (const specifier of importsIn(file, read(file))) {
    const target = resolveLocal(file, specifier)
    if (target?.error) failures.push(file + ': ' + specifier + ' (' + target.error + ')')
    if (target?.file) edges.push(target.file)
    if (specifier.startsWith('@/components/ui/tailwind/') || specifier.startsWith('@coreui/') || specifier === 'bootstrap') failures.push(file + ': retired visual import ' + specifier)
  }
  graph.set(file, edges)
}

const nextEntry = /(?:^|\/)(?:page|layout|route|error|global-error|loading|not-found|global-not-found|default|template|head|forbidden|unauthorized|sitemap|robots|manifest|icon|apple-icon|opengraph-image|twitter-image)\.[cm]?[jt]sx?$/
const entries = sourceFiles.filter(file => file.startsWith('app/') ? nextEntry.test(file) : !file.includes('/'))
const reachable = new Set()
function visit(file) {
  if (reachable.has(file)) return
  reachable.add(file)
  for (const target of graph.get(file) ?? []) visit(target)
}
entries.forEach(visit)

for (const file of ['components/ui/tailwind', 'app/styles/tokens.css', 'app/styles/ui-kit.css', 'app/coreui-scoped.css', 'app/styles/coreui-bridge.css', 'middleware.ts', 'middleware.js']) {
  if (fs.existsSync(path.join(root, file))) failures.push('Retired or conflicting source exists: ' + file)
}
const pkg = JSON.parse(read('package.json'))
for (const dependency of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
  if (dependency.startsWith('@coreui/') || dependency === 'bootstrap') failures.push('Retired visual dependency: ' + dependency)
}
const tsconfig = JSON.parse(read('tsconfig.json'))
if (!tsconfig.exclude?.includes('.performance')) failures.push('tsconfig.json must exclude .performance')
try {
  const trackedArtifacts = execFileSync('git', ['ls-files', '--', '.performance'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  if (trackedArtifacts) failures.push('.performance contains tracked artifacts')
  execFileSync('git', ['check-ignore', '--quiet', '--no-index', '.performance/audit-placeholder'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
} catch (error) {
  failures.push('Unable to confirm Git artifact exclusion: ' + (error.status ?? error.code))
}

const secondaryFiles = [...filesIn('tests'), ...filesIn('scripts')].filter(file => /\.(?:[cm]?[jt]sx?|json)$/.test(file) && file !== relative(fileURLToPath(import.meta.url)))
const secondaryTexts = secondaryFiles.map(file => ({ file, text: read(file) }))
// Tooling/test imports are checked separately and never count as mounted UI.
for (const item of secondaryTexts.filter(item => sourceExtensions.test(item.file))) {
  for (const specifier of importsIn(item.file, item.text)) {
    const target = resolveLocal(item.file, specifier)
    if (target?.error) failures.push(item.file + ': ' + specifier + ' (' + target.error + ')')
  }
  const stream = tokens(item.text)
  for (let index = 0; index < stream.length; index++) {
    if (stream[index].value !== 'loadModule' || stream[index + 1]?.value !== '(' || stream[index + 2]?.kind !== 'string') continue
    const target = stream[index + 2].value
    if (/^(?:app|components|lib|hooks)\//.test(target) && !exists(path.join(root, target))) failures.push(item.file + ': loadModule target missing ' + target)
  }
}
const publicAssets = filesIn('public')
for (const file of sourceFiles.filter(file => reachable.has(file))) {
  for (const token of tokens(read(file)).filter(token => token.kind === 'string')) {
    if (token.value.startsWith('/sounds/') && !publicAssets.includes('public' + token.value)) failures.push(file + ': public asset missing ' + token.value)
  }
}
const unmounted = sourceFiles.filter(file => !reachable.has(file) && !file.endsWith('.d.ts')).map(file => ({
  file,
  references: secondaryTexts.filter(item => item.text.includes(file) || item.text.includes('@/' + file.replace(/\.[cm]?[jt]sx?$/, ''))).map(item => item.file),
}))

console.log('Structure: ' + sourceFiles.length + ' source files, ' + entries.length + ' Next/proxy entries, ' + reachable.size + ' reachable local files.')
if (unmounted.length) {
  console.log('Unmounted source files (static imports, including type imports; review before deleting):')
  for (const item of unmounted) console.log('  ' + item.file + (item.references.length ? ' [tests/tooling: ' + item.references.join(', ') + ']' : ''))
}
console.log('Limit: literal imports/re-exports/require and CSS imports only; computed references and authorization behavior need separate review/tests.')
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('No broken literal local imports, retired visual kits, conflicting middleware or tracked benchmark artifacts.')
}

