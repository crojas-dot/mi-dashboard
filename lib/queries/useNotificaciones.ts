'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listarNotificaciones, marcarLeida, marcarTodasLeidas, archivarNotificacion, archivarTodasVisibles, type Notificacion } from '@/lib/services/notificacionService'
import { queryKeys } from './queryKeys'

export function notificacionesKey(userId: string) {
  return [...queryKeys.dashboard, 'notificaciones', userId] as const
}

export function useNotificaciones(userId: string, enabled = true) {
  return useQuery({
    queryKey: notificacionesKey(userId),
    queryFn: () => listarNotificaciones(userId),
    enabled: !!userId && enabled,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60000,
    retry: 1,
  })
}

export function useMarcarNotificacionLeida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      await marcarLeida(id)
      return userId
    },
    onSuccess: (userId) => queryClient.invalidateQueries({ queryKey: notificacionesKey(userId) }),
  })
}

export function useMarcarTodasLeidas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      await marcarTodasLeidas(userId)
      return userId
    },
    onSuccess: (userId) => queryClient.invalidateQueries({ queryKey: notificacionesKey(userId) }),
  })
}

export function useArchivarNotificacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      await archivarNotificacion(id)
      return userId
    },
    onSuccess: (userId) => queryClient.invalidateQueries({ queryKey: notificacionesKey(userId) }),
  })
}

export function useArchivarTodas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      await archivarTodasVisibles(userId)
      return userId
    },
    onSuccess: (userId) => queryClient.invalidateQueries({ queryKey: notificacionesKey(userId) }),
  })
}
