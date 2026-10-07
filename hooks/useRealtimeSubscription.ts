'use client'

import { useEffect, useRef } from 'react'
import { partialMatchKey, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TableName =
  | 'quejas'
  | 'notificaciones'
  | 'acciones'
  | 'auditorias'
  | 'documentos'
  | 'procesos'
  | 'reuniones'
  | 'riesgos'

interface SubscriptionConfig {
  table: TableName
  filter?: string
  invalidateKeys: readonly (readonly unknown[])[]
  /** Solo estos eventos. Default: INSERT, UPDATE y DELETE. */
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[]
}

function compactKeys(keys: readonly (readonly unknown[])[]): (readonly unknown[])[] {
  let result: (readonly unknown[])[] = []
  for (const key of keys) {
    // Usa el mismo matching de TanStack: un prefijo padre cubre sus descendientes.
    if (result.some((prefix) => partialMatchKey(key, prefix))) continue
    result = result.filter((existing) => !partialMatchKey(existing, key))
    result.push(key)
  }
  return result
}

/** Agrupa invalidaciones durante 750 ms sin postergar una ráfaga indefinidamente. */
export function useRealtimeSubscription(config: SubscriptionConfig) {
  const queryClient = useQueryClient()
  const configRef = useRef(config)
  useEffect(() => { configRef.current = config }, [config])

  useEffect(() => {
    let active = true
    let subscribed = false
    let needsResync = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let pendingKeys: (readonly unknown[])[] = []

    const flush = (refetchType: 'active' | 'none') => {
      const keys = pendingKeys
      pendingKeys = []
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key, refetchType })
    }
    const queueInvalidation = () => {
      if (!active) return
      pendingKeys = compactKeys([...pendingKeys, ...configRef.current.invalidateKeys])
      if (timer !== null) return
      timer = setTimeout(() => {
        timer = null
        if (active) flush('active')
      }, 750)
    }

    const channel = supabase
      .channel('realtime-' + config.table + '-' + (config.filter ?? 'all'))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: config.table,
          ...(config.filter ? { filter: config.filter } : {}),
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (!active) return
          const eventType = payload.eventType.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE'
          if (!(configRef.current.events ?? ['INSERT', 'UPDATE', 'DELETE']).includes(eventType)) return
          queueInvalidation()
        },
      )
      .subscribe((status) => {
        if (!active) return
        if (status === 'SUBSCRIBED') {
          // La conexión inicial ya coincide con el fetch de la vista. Solo una
          // reconexión puede haber perdido eventos y necesita resincronización.
          if (needsResync) queueInvalidation()
          subscribed = true
          needsResync = false
        } else if (subscribed && ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          needsResync = true
        }
      })

    return () => {
      active = false
      if (timer !== null) clearTimeout(timer)
      timer = null
      // Conserva los cambios recibidos al salir: el próximo montaje relee la
      // caché invalidada, sin iniciar requests de una pantalla que ya se cerró.
      flush('none')
      void supabase.removeChannel(channel)
    }
  }, [queryClient, config.table, config.filter])
}
