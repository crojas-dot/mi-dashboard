'use client'

import { useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface PrefetchConfig {
  queryKey: readonly unknown[]
  queryFn: () => PromiseLike<unknown>
  staleTime?: number
}

/**
 * Predictive prefetching on hover intent.
 *
 * Usage:
 *   const prefetch = useHoverPrefetch()
 *   <Link onMouseEnter={() => prefetch({ queryKey: ['quejas'], queryFn: () => fetchQuejas() })}>
 *
 * Pre-fetches data into the React Query cache so navigation is instant.
 */
export function useHoverPrefetch() {
  const queryClient = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflightRef = useRef<Set<string>>(new Set())

  const prefetch = useCallback(
    (config: PrefetchConfig) => {
      const key = JSON.stringify(config.queryKey)
      if (inflightRef.current.has(key)) return

      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(() => {
        const cached = queryClient.getQueryData(config.queryKey)
        if (cached !== undefined) return

        inflightRef.current.add(key)
        queryClient.prefetchQuery({
          queryKey: config.queryKey,
          queryFn: config.queryFn,
          staleTime: config.staleTime ?? 30 * 1000,
        }).finally(() => {
          inflightRef.current.delete(key)
        })
      }, 80)
    },
    [queryClient],
  )

  return prefetch
}
