import type { ReactNode } from 'react'
import FondoIdentidad from '@/components/identidad/FondoIdentidad'
import { identidadLoginInicial } from '@/lib/server/identidad-publica'

// No congelar el fondo en una compilación de Next.js: Identidad lo cambia en runtime.
export const dynamic = 'force-dynamic'

export default async function LoginLayout({ children }: { children: ReactNode }) {
  const { fondo, logo } = await identidadLoginInicial()
  return <>
    {fondo && <link rel="preload" as="image" href={fondo} />}
    <FondoIdentidad slot="login_fondo" initialUrl={fondo} initialLogo={logo}>
      {children}
    </FondoIdentidad>
  </>
}
