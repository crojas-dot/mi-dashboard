'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
  /** Only listen for these events. Default: ['INSERT', 'UPDATE'] */
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[]
}

/**
 * Subscribes to Supabase Realtime changes and invalidates React Query cache.
 *
 * Usage (in layout or page):
 *   useRealtimeSubscription({
 *     table: 'quejas',
 *     invalidateKeys: [['quejas'], ['dashboard-stats']],
 *   })
 *
 *   useRealtimeSubscription({
 *     table: 'notificaciones',
 *     filter: `user_id=eq.${userId}`,
 *     invalidateKeys: [['notificaciones', userId]],
 *   })
 */
export function useRealtimeSubscription(config: SubscriptionConfig) {
  const queryClient = useQueryClient()
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const events = config.events ?? ['INSERT', 'UPDATE']

    const channel = supabase
      .channel(`realtime-${config.table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: config.table,
          ...(config.filter ? { filter: config.filter } : {}),
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const eventType = payload.eventType.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE'
          if (!events.includes(eventType)) return

          const keys = configRef.current.invalidateKeys
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: [...key] })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, config.table, config.filter])
}
