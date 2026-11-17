'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function FotoPerfil({ url, initials, size, className }: {
  url?: string
  initials: string
  size: number
  className: string
}) {
  const [loaded, setLoaded] = useState<string>()
  return <span aria-hidden="true" className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}>
    <span className="translate-y-px leading-none">{initials}</span>
    {url && <Image key={url} src={url} alt="" width={size} height={size} unoptimized
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 motion-reduce:transition-none ${loaded === url ? 'opacity-100' : 'opacity-0'}`}
      onLoad={() => setLoaded(url)} />}
  </span>
}
