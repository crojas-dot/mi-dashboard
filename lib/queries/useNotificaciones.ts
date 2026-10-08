'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listarNotificaciones, marcarLeida, marcarTodasLeidas, archivarNotificacion, archivarTodasVisibles } from '@/lib/services/notificacionService';
import { queryKeys } from './queryKeys';
import { showError } from '@/lib/services/errorToast';

export function notificacionesKey(userId: string) {
  return [...queryKeys.notificaciones, userId] as const
}

export function useNotificaciones(userId: string, enabled = true) {
  return useQuery({
    queryKey: notificacionesKey(userId),
    queryFn: ({ signal }) => listarNotificaciones(userId, signal),
    enabled: !!userId && enabled,
    refetchInterval: 60000,
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
    onError: (error) => showError(error, 'No se pudo marcar la notificación como leída.'),
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
    onError: (error) => showError(error, 'No se pudieron marcar las notificaciones como leídas.'),
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
    onError: (error) => showError(error, 'No se pudo archivar la notificación.'),
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
    onError: (error) => showError(error, 'No se pudieron archivar las notificaciones.'),
  })
}
