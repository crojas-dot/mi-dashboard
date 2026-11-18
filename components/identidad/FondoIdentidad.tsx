'use client'

import type { ReactNode } from 'react'
import { useIdentidadImagenes } from '@/lib/queries/useIdentidadImagenes'
import type { ImagenIdentidad } from '@/lib/constants/identidad'

/** Imagen de fondo pública y opcional; no altera los formularios ni el guard de sesión. */
export default function FondoIdentidad({ slot, children }: {
  slot: Extract<ImagenIdentidad, 'login_fondo' | 'formulario_fondo'>
  children: ReactNode
}) {
  const { data } = useIdentidadImagenes()
  const url = data?.[slot] || ''
  return <div className="relative isolate min-h-dvh bg-qms-background">
    {url && <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${url}")` }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-white/70" />
    </>}
    <div className="relative z-0 min-h-dvh">{children}</div>
  </div>
}
