'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store/auth-store'

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
            staleTime: 30_000,
            gcTime: 30 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchOnMount: true,
            refetchInterval: 60_000,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  )

  useEffect(() => () => { queryClient.clear() }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
