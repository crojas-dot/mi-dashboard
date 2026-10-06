import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import LegacyViewBoundary from '@/components/LegacyViewBoundary'
import Card from '@/components/ui/Card'
import { useHeaderAction } from '@/hooks/useHeaderAction'
import { useAuthStore } from '@/lib/store/auth-store'

function Preview() {
  const pathname = usePathname()
  const [message, setMessage] = useState('Verificación local con datos ficticios')
  const restricted = useAuthStore(s => s.user?.rol === 'colaborador')
  useHeaderAction({ label: 'Nueva queja', onClick: () => setMessage('Acción de la ruta preservada') })
  return <AuthenticatedLayout><LegacyViewBoundary>
    <Card title="Expedientes de calidad"><p>{message}</p><p>Ruta: {pathname}</p>
      <div className="table-responsive"><table className="table"><thead><tr><th>Folio</th><th>Persona o empresa</th><th>Estado</th></tr></thead><tbody><tr><td>2026-001</td><td>Datos de ejemplo</td><td>En Investigación</td></tr></tbody></table></div>
      <button type="button" onClick={() => (useAuthStore as any).getState().setRestricted(!restricted)}>Alternar permisos de prueba</button>
    </Card>
  </LegacyViewBoundary></AuthenticatedLayout>
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><Preview /></QueryClientProvider>)
