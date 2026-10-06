'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'

export type SemanticColor = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'secondary'
export interface StageRule { id: number; stage_id: string; duration: number; day_type: 'business_days' | 'calendar_days'; alerts: number[]; expiration_action: 'notify_quality' | 'mark_only' }
export interface Stage { id: string; process_id: string; name: string; start_event: string; end_event: string; rule: StageRule }
export interface Calendar { id: number; weekdays: number[]; holidays: {date: string; description: string}[]; timezone: string }
export const stageRulesKey = ['stage-rules'] as const
export const calendarKey = ['work-calendar'] as const

export function useStageRules() {
  return useQuery({ queryKey: stageRulesKey, queryFn: async ({ signal }) => {
    const { data, error } = await supabase.from('qms_current_stages').select('*').abortSignal(signal)
    if (error) throw error
    return (data ?? []) as Stage[]
  } })
}
export function useWorkCalendar() {
  return useQuery({ queryKey: calendarKey, queryFn: async ({signal}) => {
    const { data, error } = await supabase.from('qms_calendars').select('*').order('id',{ascending:false}).limit(1).abortSignal(signal).single()
    if (error) throw error
    return data as Calendar
  } })
}
/** Publish instead of update: in-flight cases keep their saved rule and calendar. */
export function usePublishConfiguration(kind: 'stage' | 'calendar') {
  const client = useQueryClient()
  return useMutation({ retry: false, mutationFn: async (args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(kind === 'stage' ? 'qms_publish_stage' : 'qms_publish_calendar', args)
    if (error) throw error
  }, onSuccess: async () => {
    await Promise.all([stageRulesKey,calendarKey,queryKeys.dashboard,['config-audit']].map(queryKey => client.invalidateQueries({queryKey})))
  } })
}
