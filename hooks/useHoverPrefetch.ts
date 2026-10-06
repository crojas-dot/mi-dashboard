'use client'

import { useRef, useCallback, useEffect } from 'react'
import { useQueryClient, type QueryFunction, type QueryKey } from '@tanstack/react-query'
import { getCacheConfig } from '@/lib/queries/cacheConfig'

export interface PrefetchConfig {
  queryKey: QueryKey
  queryFn: QueryFunction<unknown>
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const prefetch = useCallback(
    (config: PrefetchConfig | PrefetchConfig[]) => {
      const configs = Array.isArray(config) ? config : [config]
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        for (const entry of configs) {
          const key = JSON.stringify(entry.queryKey)
          if (inflightRef.current.has(key)) continue
          inflightRef.current.add(key)
          void queryClient.prefetchQuery({
            queryKey: entry.queryKey,
            queryFn: entry.queryFn,
            staleTime: entry.staleTime ?? getCacheConfig(entry.queryKey).staleTime,
          }).finally(() => {
            inflightRef.current.delete(key)
          })
        }
      }, 80)
    },
    [queryClient],
  )

  return prefetch
}
