'use client'

import { useState } from 'react'
import { useLogoEmpresa } from '@/lib/queries/useLogoEmpresa'

/**
 * Marca del shell. Con logo, la imagen se muestra sola: sin máscara circular ni
 * fondo, así un PNG con transparencia conserva su forma. Sin logo (o si la URL
 * falla) se usa la inicial «E» dentro del círculo azul. Guarda la URL que falló,
 * no un booleano: una carga posterior se intenta sin intervención.
 */
export default function EmpresaLogo({ className = '' }: { className?: string }) {
  const { data } = useLogoEmpresa()
  const url = data ?? ''
  const [fallo, setFallo] = useState('')

  if (url && fallo !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        draggable={false}
        onError={() => setFallo(url)}
        className={`shrink-0 object-contain ${className}`}
      />
    )
  }

  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-qms-primary font-semibold text-white ${className}`}>
      <span className="translate-y-px leading-none">E</span>
    </span>
  )
}
