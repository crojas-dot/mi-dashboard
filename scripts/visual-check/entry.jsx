// Isolated visual fixture: real UI components, synthetic data, no backend.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import AuthShell from '../../components/AuthShell'
import Dashboard from '../../app/page'
import Quejas from '../../app/quejas/page'
import MisQuejas from '../../app/mis-quejas/page'
import Documentos from '../../app/documentos/page'
const client = new QueryClient()
function Preview() {
  const pathname = usePathname()
  const Page = ({ '/quejas': Quejas, '/mis-quejas': MisQuejas, '/documentos': Documentos })[pathname] || Dashboard
  return <QueryClientProvider client={client}><AuthShell><Page /></AuthShell></QueryClientProvider>
}
createRoot(document.getElementById('root')).render(<Preview />)
