import type { Metadata } from 'next'
import PublicTrackingPage from '@/app/q/seguimiento/PublicTrackingPage'
import { publicTrackingAvailable } from '@/lib/server/publicTracking'

export const metadata: Metadata = {
  title: 'Seguimiento de tu trámite | QMS ECA',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

// El HTML inicial es genérico. El expediente solo se consulta mediante POST con la clave privada.
export default function SeguimientoPage() { return <PublicTrackingPage available={publicTrackingAvailable()} /> }
