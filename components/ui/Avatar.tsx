'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'

interface AvatarProps extends Omit<ImageProps, 'src' | 'alt'> {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'circle' | 'square'
}

const sizeClasses: Record<string, string> = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
}

export function Avatar({ fallback, size = 'md', shape = 'circle', className = '', src, alt, ...props }: AvatarProps) {
  const [error, setError] = useState(false)

  const initials = fallback
    ? fallback.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-md'

  if (src && !error) {
    return (
      <Image
        unoptimized
        width={{ sm: 24, md: 32, lg: 40, xl: 48 }[size]}
        height={{ sm: 24, md: 32, lg: 40, xl: 48 }[size]}
        src={src}
        alt={alt || fallback || 'Avatar'}
        className={`${sizeClasses[size]} ${shapeClass} object-cover ${className}`}
        onError={() => setError(true)}
        {...props}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} ${shapeClass} flex items-center justify-center font-medium text-white ${className}`}
      style={{ backgroundColor: '#0d6efd' }}
      aria-label={fallback || 'Avatar'}
    >
      {initials}
    </div>
  )
}