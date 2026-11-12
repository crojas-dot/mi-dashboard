'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queries/queryKeys'
import { MOTIVOS_AGENDA, type AgendaHoyItem } from '@/lib/constants/agenda'
import { esFechaCalendarioQms } from '@/lib/utils/qmsCalendar'

export function parseAgendaHoy(value: unknown): AgendaHoyItem[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Respuesta de agenda inválida')
  const ids = new Set<string>()
  return value.map(item => {
    if (!item || typeof item !== 'object' || Object.keys(item).sort().join(',') !== 'codigo,descripcion,fecha_limite,id,motivo,ruta'
      || typeof item.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
      || typeof item.codigo !== 'string' || !item.codigo || item.codigo.length > 120
      || typeof item.descripcion !== 'string' || item.descripcion.length > 320
      || typeof item.motivo !== 'string' || !Object.hasOwn(MOTIVOS_AGENDA,item.motivo)
      || (item.fecha_limite !== null && !esFechaCalendarioQms(item.fecha_limite))
      || !['/quejas','/mis-quejas','/auditorias'].includes(item.ruta)) throw new Error('Respuesta de agenda inválida')
    const key = `${item.ruta}:${item.id}`
    if (ids.has(key)) throw new Error('Respuesta de agenda duplicada')
    ids.add(key)
    return item as AgendaHoyItem
  })
}

export async function fetchAgendaHoy(signal?: AbortSignal): Promise<AgendaHoyItem[]> {
  const query = supabase.rpc('qms_get_agenda_hoy')
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return parseAgendaHoy(data)
}

export function agendaHoyOptions(userId: string) {
  return {
    queryKey: [...queryKeys.agendaHoy, 'v3', userId] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAgendaHoy(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!userId,
  }
}

export function useAgendaHoy(userId: string) { return useQuery(agendaHoyOptions(userId)) }
