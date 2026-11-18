'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries/queryKeys'
import { leerFotoPerfil } from '@/lib/services/miPerfilService'
import { useAuthStore } from '@/lib/store/auth-store'

export function useFotoPerfil() {
  const authId = useAuthStore(state => state.accessIdentity)
  const path = useAuthStore(state => state.user?.avatarUrl)
  const photo = useQuery({
    queryKey: [...queryKeys.fotoPerfil, authId, path],
    queryFn: ({ signal }) => leerFotoPerfil(authId, signal, path),
    enabled: !!authId && !!path,
    staleTime: 10 * 60_000,
  }).data
  const [image, setImage] = useState<{ photo: Blob; url: string } | null>(null)

  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo)
    const frame = requestAnimationFrame(() => setImage({ photo, url }))
    return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(url) }
  }, [photo])

  return image?.photo === photo ? image?.url : undefined
}
