'use client'

import { useState } from 'react'
import Image from 'next/image'

// Un solo objeto URL puede aparecer en el encabezado, el menú y el modal.
// Reutilizar el estado de carga evita volver a mostrar las iniciales al abrir otro panel.
const fotosListas = new Set<string>()

export default function FotoPerfil({ url, initials, size, className, hasPhoto = false }: {
  url?: string
  initials: string
  size: number
  className: string
  hasPhoto?: boolean
}) {
  const [loaded, setLoaded] = useState<string>()
  const [failed, setFailed] = useState<string>()
  const mostrarImagen = !!url && (loaded === url || fotosListas.has(url))
  const esperandoFoto = hasPhoto && (!url || failed !== url) && !mostrarImagen

  return <span aria-hidden="true" className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
    // Antes de cargar una foto privada no debe asomarse el fondo azul del avatar vacío.
    style={hasPhoto ? { backgroundColor: '#e9edf2' } : undefined}>
    {!hasPhoto || (url && failed === url) ? (
      <span className="translate-y-px leading-none">{initials}</span>
    ) : esperandoFoto ? (
      <span data-avatar-loading className="absolute inset-0 rounded-full bg-[#e9edf2]" />
    ) : null}
    {url && failed !== url && <Image key={url} src={url} alt="" width={size} height={size} unoptimized
      className={`absolute inset-0 h-full w-full object-cover ${mostrarImagen ? 'opacity-100' : 'opacity-0'}`}
      onLoad={() => { fotosListas.add(url); setLoaded(url) }}
      onError={() => setFailed(url)} />}
  </span>
}
