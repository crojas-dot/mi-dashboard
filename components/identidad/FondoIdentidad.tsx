'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useIdentidadImagenes } from '@/lib/queries/useIdentidadImagenes'
import type { ImagenIdentidad } from '@/lib/constants/identidad'

const LoginLogoContext = createContext('')

/** Permite compartir el logo público ya cargado por el servidor con el formulario. */
export function useLogoLogin(): string {
  return useContext(LoginLogoContext)
}

/** Imagen de fondo pública y opcional; no altera los formularios ni el guard de sesión. */
export default function FondoIdentidad({ slot, children, initialUrl = '', initialLogo = '' }: {
  slot: Extract<ImagenIdentidad, 'login_fondo'>
  children: ReactNode
  initialUrl?: string
  initialLogo?: string
}) {
  const { data } = useIdentidadImagenes()
  // Render del servidor primero: evita pantalla vacía mientras carga el cliente.
  const url = initialUrl || data?.[slot] || ''
  return <LoginLogoContext.Provider value={initialLogo}>
    <div className={`relative isolate min-h-dvh ${url ? 'bg-[#082440]' : 'bg-qms-background'}`}>
    {url && <>
      {/* La etiqueta img permite comprobar la carga y aprovecha la caché HTTP de Storage. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-login-fondo aria-hidden="true" src={url} alt="" loading="eager" fetchPriority="high"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-black/10" />
    </>}
    <div className="relative z-10 min-h-dvh">{children}</div>
    </div>
  </LoginLogoContext.Provider>
}
