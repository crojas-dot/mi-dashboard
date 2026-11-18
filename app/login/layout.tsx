import type { ReactNode } from 'react'
import FondoIdentidad from '@/components/identidad/FondoIdentidad'
import { identidadLoginInicial } from '@/lib/server/identidad-publica'

// Identidad puede cambiar el logo y el fondo sin republicar la web.
export const dynamic = 'force-dynamic'

export default async function LoginLayout({ children }: { children: ReactNode }) {
  const { fondo, logo } = await identidadLoginInicial()
  return <>
    {fondo && <link rel="preload" as="image" href={fondo} />}
    {logo && <link rel="preload" as="image" href={logo} />}
    <FondoIdentidad slot="login_fondo" initialUrl={fondo} initialLogo={logo}>
      {children}
    </FondoIdentidad>
  </>
}
