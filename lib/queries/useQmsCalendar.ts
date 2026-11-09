'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseQmsCalendar, type QmsCalendar } from '@/lib/utils/qmsCalendar'
import { queryKeys } from './queryKeys'

export const qmsCalendarKey = queryKeys.qmsCalendar

export async function fetchQmsCalendar(signal?: AbortSignal): Promise<QmsCalendar | null> {
  const query = supabase.from('qms_calendars').select('id,weekdays,holidays,timezone,created_at')
    .order('id', { ascending: false }).limit(1)
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw error
  return data?.length ? parseQmsCalendar(data[0]) : null
}

export function useQmsCalendar(enabled = true) {
  return useQuery({ queryKey: qmsCalendarKey, queryFn: ({ signal }) => fetchQmsCalendar(signal), enabled })
}
