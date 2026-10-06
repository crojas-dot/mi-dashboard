'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store/auth-store'
import { logger } from '@/lib/utils/logger'

const CACHE_CONFIG = {
  dashboard: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
  quejas: { staleTime: 30 * 1000, gcTime: 3 * 60 * 1000 },
  usuarios: { staleTime: 30 * 1000, gcTime: 3 * 60 * 1000 },
  catalogos: { staleTime: 30 * 1000, gcTime: 3 * 60 * 1000 },
  auditorias: { staleTime: 30 * 1000, gcTime: 3 * 60 * 1000 },
  configuraciones: { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  permisos: { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  procesos: { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  notificaciones: { staleTime: 15 * 1000, gcTime: 1 * 60 * 1000 },
  actividad: { staleTime: 15 * 1000, gcTime: 1 * 60 * 1000 },
  default: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
} as const

function getCacheConfig(queryKey: unknown) {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    return CACHE_CONFIG.default
  }

  const firstKey = String(queryKey[0])
  return (CACHE_CONFIG as Record<string, any>)[firstKey] ?? CACHE_CONFIG.default
}

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const scope = useAuthStore((state) =>
    `${state.user?.id ?? 'public'}:${state.user?.rol ?? ''}:${state.vistaActiva ?? ''}`,
  )

  return <ScopedQueryProvider key={scope}>{children}</ScopedQueryProvider>
}

function ScopedQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: (query) => getCacheConfig(query.queryKey).staleTime,
            gcTime: (query) => getCacheConfig(query.queryKey).gcTime,
            retry: (failureCount, error: any) => {
              if (error?.status === 401 || error?.status === 403) return false
              return failureCount < 1
            },
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'stale',
            refetchOnMount: 'stale',
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  )

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (process.env.NODE_ENV === 'development' && event.type === 'removed') {
        logger.debug('Query removed from cache', {
          queryKey: event.query.queryKey,
          module: 'QueryProvider',
        })
      }
    })

    return () => unsubscribe()
  }, [queryClient])

  useEffect(() => () => {
    queryClient.clear()
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
