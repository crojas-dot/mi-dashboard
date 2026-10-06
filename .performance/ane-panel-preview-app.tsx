import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import AuthShell from '@/components/AuthShell'
import Procesos from '@/app/procesos/page'
import Auditorias from '@/app/auditorias/page'
import Riesgos from '@/app/riesgos/page'
import Revision from '@/app/revision/page'
import Documentos from '@/app/documentos/page'
import Dashboard from '@/app/page';import Quejas from '@/app/quejas/page';import MisQuejas from '@/app/mis-quejas/page';import Configuracion from '@/app/configuracion/page';
const routes={ '/':Dashboard,'/quejas':Quejas,'/mis-quejas':MisQuejas,'/configuracion':Configuracion,'/procesos':Procesos, '/auditorias':Auditorias, '/riesgos':Riesgos, '/revision':Revision, '/documentos':Documentos }
function Preview(){const pathname=usePathname();const Page=routes[pathname]??Procesos;return <AuthShell><Page key={pathname}/></AuthShell>}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><Preview/></QueryClientProvider>)
