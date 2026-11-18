'use client'

import { useState } from 'react'
import { LOGO_ECA_LOCAL } from '@/lib/constants/marca'

/** El isotipo local cubre la espera y los errores de una imagen configurada. */
export default function EmpresaLogo({ url, className = '' }: { url?: string; className?: string }) {
  const [cargada, setCargada] = useState('')
  const personalizadaVisible = !!url && cargada === url

  return (
    <span aria-hidden="true" className={`relative block shrink-0 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_ECA_LOCAL} alt="" draggable={false}
        className={`h-full w-full object-contain ${personalizadaVisible ? 'invisible' : ''}`} />
      {url && url !== LOGO_ECA_LOCAL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt="" draggable={false} onLoad={() => setCargada(url)} onError={() => setCargada('')}
          className={`absolute inset-0 h-full w-full object-contain ${personalizadaVisible ? '' : 'invisible'}`} />
      )}
    </span>
  )
}
