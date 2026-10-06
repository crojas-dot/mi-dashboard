import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Configuracion from '@/app/configuracion/page'
import AuthShell from '@/components/AuthShell'

const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><AuthShell><Configuracion /></AuthShell></QueryClientProvider>)
