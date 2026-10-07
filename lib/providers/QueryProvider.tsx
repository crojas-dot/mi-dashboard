'use client'

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store/auth-store'
import { logger } from '@/lib/utils/logger'
import { retryRead } from '@/lib/errors/userError'
import { CACHE_CONFIG, getCacheConfig } from '@/lib/queries/cacheConfig'
import { queryKeys } from '@/lib/queries/queryKeys'

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const scope = useAuthStore((state) =>
    `${state.user?.id ?? 'public'}:${state.user?.rol ?? ''}:${state.vistaActiva ?? ''}`,
  )
  return <ScopedQueryProvider key={scope} userId={scope.split(':')[0]}>{children}</ScopedQueryProvider>
}

function ScopedQueryProvider({ children, userId }: { children: React.ReactNode; userId?: string }) {
  const [queryClient] = useState(
    () => {
      const client = new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => logger.error('Falló una consulta de caché', {
            module: String(query.queryKey[0]), action: 'query', userId,
          }, error),
        }),
        mutationCache: new MutationCache({
          onError: (error) => logger.error('Falló una mutación', { action: 'mutation', userId }, error),
        }),
        defaultOptions: {
          queries: {
            ...CACHE_CONFIG.default,
            retry: retryRead,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
          },
          mutations: {
            retry: 0,
          },
        },
      })
      for (const key of Object.values(queryKeys)) client.setQueryDefaults(key, getCacheConfig(key))
      return client
    },
  )

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'removed') {
        logger.debug('Consulta retirada de caché', {
          module: String(event.query.queryKey[0]), action: 'cache_removed', userId,
        })
      }
    })
  }, [queryClient, userId])

  useEffect(() => () => { queryClient.clear() }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
