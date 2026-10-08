import type { QueryClient } from '@tanstack/react-query'

// Solo registra la vigencia de cada cliente; los datos y la identidad siguen en QueryProvider.
const contexts = new WeakMap<QueryClient, { generation: number; active: boolean }>()

export function activateQueryContext(client: QueryClient) {
  const context = contexts.get(client) ?? { generation: 0, active: false }
  contexts.set(client, context)
  const generation = ++context.generation
  context.active = true
  return () => {
    if (context.generation !== generation) return
    context.generation++
    context.active = false
  }
}

export function captureQueryContext(client: QueryClient) {
  const context = contexts.get(client)
  const generation = context?.generation
  return () => !!context?.active && context.generation === generation
}
