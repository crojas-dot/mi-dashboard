import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import Procesos from '@/app/procesos/page'
import Auditorias from '@/app/auditorias/page'
import Riesgos from '@/app/riesgos/page'
import Revision from '@/app/revision/page'
import Documentos from '@/app/documentos/page'
const routes={ '/procesos':Procesos, '/auditorias':Auditorias, '/riesgos':Riesgos, '/revision':Revision, '/documentos':Documentos }
function Preview(){const pathname=usePathname();const Page=routes[pathname]??Procesos;return <AuthenticatedLayout><Page key={pathname}/></AuthenticatedLayout>}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><Preview/></QueryClientProvider>)
