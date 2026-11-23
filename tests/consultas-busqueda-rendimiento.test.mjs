import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, QueryObserver, keepPreviousData } from '@tanstack/react-query'
import { loadModule } from './load-module.mjs'

function searchHarness() {
  let initialized = false
  let state
  let dependencies
  let cleanup
  const { useDebouncedSearch } = loadModule('hooks/useDebouncedSearch.ts', {
    react: {
      useState(initial) {
        if (!initialized) {
          initialized = true
          state = initial
        }
        return [state, value => { state = value }]
      },
      useEffect(callback, nextDependencies) {
        if (dependencies && nextDependencies.every((value, index) => value === dependencies[index])) return
        cleanup?.()
        dependencies = nextDependencies
        cleanup = callback()
      },
    },
  })
  return useDebouncedSearch
}

const { useQuejas: queryOptions, quejasKey } = loadModule('lib/queries/useQuejas.ts', {
  '@tanstack/react-query': { keepPreviousData, useQuery: options => options },
  '@/lib/supabase': { supabase: {} },
})

test('espera 350 ms desde el último término y conserva la clave ante espacios equivalentes', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const render = searchHarness()
  assert.deepEqual({ ...render('') }, { search: '', ready: true })
  assert.deepEqual({ ...render('  AUD  ') }, { search: 'AUD', ready: false })
  t.mock.timers.tick(200)
  assert.deepEqual({ ...render('AUD-010') }, { search: 'AUD-010', ready: false })
  t.mock.timers.tick(349)
  assert.equal(render(' AUD-010 ').ready, false)
  t.mock.timers.tick(1)
  assert.equal(render('AUD-010').ready, true)
  assert.deepEqual(quejasKey({ search: ' AUD-010 ' }), quejasKey({ search: 'AUD-010' }))
})

test('cambiar el término cancela la consulta anterior antes de habilitar la siguiente', async () => {
  const client = new QueryClient()
  const reads = []
  function options(search, enabled) {
    return {
      ...queryOptions({ search }, enabled),
      queryFn: ({ signal }) => new Promise(resolve => {
        reads.push({ signal, search, resolve })
      }),
    }
  }
  const observer = new QueryObserver(client, options('AUD', true))
  const stop = observer.subscribe(() => {})
  try {
    assert.equal(reads.length, 1)
    observer.setOptions(options('AUD-7', false))
    assert.equal(reads[0].signal.aborted, true)
    assert.equal(reads.length, 1)
    observer.setOptions(options('AUD-70', false))
    assert.equal(reads.length, 1)
    observer.setOptions(options('AUD-70', true))
    assert.equal(reads.length, 2)
    assert.equal(reads[1].search, 'AUD-70')
    reads[1].resolve({ data: [], count: 0, origen: 'bandeja' })
  } finally {
    stop()
    client.clear()
  }
})

test('reutiliza la página fresca al remontar y vuelve a leer una página invalidada', async () => {
  const client = new QueryClient()
  let calls = 0
  const options = {
    ...queryOptions({ page: 1 }),
    async queryFn() {
      calls += 1
      return { data: [], count: 0, origen: 'bandeja' }
    },
  }
  try {
    const first = new QueryObserver(client, options)
    const stopFirst = first.subscribe(() => {})
    await first.refetch()
    stopFirst()
    assert.equal(calls, 1)

    const second = new QueryObserver(client, options)
    const stopSecond = second.subscribe(() => {})
    assert.equal(calls, 1)
    stopSecond()

    await client.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' })
    const third = new QueryObserver(client, options)
    const stopThird = third.subscribe(() => {})
    assert.equal(calls, 2)
    stopThird()
  } finally {
    client.clear()
  }
})
