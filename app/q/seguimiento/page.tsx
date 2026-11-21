import type { Metadata } from 'next'
import PublicTrackingPage from '@/app/q/seguimiento/PublicTrackingPage'
import { publicTrackingAvailable } from '@/lib/server/publicTracking'
import FondoIdentidad from '@/components/identidad/FondoIdentidad'
import { identidadFormularioInicial } from '@/lib/server/identidad-publica'

// La marca se lee al abrir la pantalla, no durante el build de Vercel.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Seguimiento de tu trámite | QMS ECA',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

// El HTML inicial es genérico. El expediente solo se consulta mediante POST con la clave privada.
export default async function SeguimientoPage() {
  const { formulario_encabezado: logo, login_fondo: fondo } = await identidadFormularioInicial(false)
  return <FondoIdentidad slot="login_fondo" initialUrl={fondo} initialLogo="">
    <div className="mx-auto flex min-h-dvh w-full max-w-[860px] flex-col px-4 py-4 text-qms-dark antialiased sm:py-6">
      <PublicTrackingPage available={publicTrackingAvailable()} initialLogo={logo} />
    </div>
  </FondoIdentidad>
}
