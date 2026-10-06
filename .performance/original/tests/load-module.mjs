import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')

// Ejecuta los módulos reales con dobles de red; nunca usa credenciales ni la BD real.
export function loadModule(filename, mocks = {}, globals = {}) {
  const cache = new Map()
  function load(file) {
    const resolved = path.resolve(root, file)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const loadedModule = { exports: {} }
    cache.set(resolved, loadedModule)
    const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: resolved,
    }).outputText
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      if (id === 'server-only') return {}
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(resolved), id)
        const target = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
        if (target) return load(target)
      }
      return nativeRequire(id)
    }
    const context = { console, setTimeout, clearTimeout, Buffer, Date, Request, Response, FormData, File,
      ReadableStream, AbortController, AbortSignal, DOMException, URL, fetch, ...globals }
    const execute = new vm.Script(`(function(require, module, exports) { ${source}\n})`, { filename: resolved }).runInNewContext(context)
    execute(localRequire, loadedModule, loadedModule.exports)
    return loadedModule.exports
  }
  return load(filename)
}

export function fakeDatabase(tables, failures = {}) {
  const calls = []
  const supabase = { from(table) {
    const call = { table, filters: [], orders: [], start: 0, end: Infinity, head: false }
    calls.push(call)
    const query = {
      select(_columns, options = {}) { call.columns = _columns; call.head = options.head; return query },
      eq(key, value) { call.filters.push((row) => row[key] === value); return query },
      neq(key, value) { call.filters.push((row) => row[key] !== value); return query },
      not(key, _operator, value) { const excluded = value.slice(1, -1).replaceAll('"', '').split(','); call.filters.push((row) => !excluded.includes(row[key])); return query },
      order(key, options = {}) { call.orders.push({ key, ascending: options.ascending !== false, nullsFirst: options.nullsFirst }); return query },
      limit(size) { call.end = size - 1; return query },
      range(start, end) { call.start = start; call.end = end; return query },
      then(resolve, reject) {
        const rows = (tables[table] ?? []).filter((row) => call.filters.every((filter) => filter(row)))
        rows.sort((a, b) => {
          for (const { key, ascending, nullsFirst } of call.orders) {
            if (a[key] === b[key]) continue
            if (a[key] == null) return nullsFirst === false ? 1 : -1
            if (b[key] == null) return nullsFirst === false ? -1 : 1
            return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1)
          }
          return 0
        })
        return Promise.resolve({ data: call.head ? null : rows.slice(call.start, call.end + 1), count: rows.length, error: failures[table] ?? null }).then(resolve, reject)
      },
    }
    return query
  } }
  return { supabase, calls }
}
