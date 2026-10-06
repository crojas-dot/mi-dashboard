'use client'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import type { SemanticColor } from './useStageRules'
export type DeadlineStatus = 'overdue' | 'today' | 'soon' | 'within' | 'unconfigured' | 'completed'
export interface WorkItem { id: string; module: string; folio: string; title: string; categoria: string; state: string; color: SemanticColor; prioridad: string; due: string | null; situation: DeadlineStatus; days: number | null }
export interface CountGroup { label: string; total: number; color?: SemanticColor }
export interface DeadlineDashboard {
  as_of: string; buckets: Partial<Record<DeadlineStatus,number>>; modules: CountGroup[]; states: CountGroup[]; categories: CountGroup[]
  trend: {month: string; opened: number; closed: number}[]; attention: WorkItem[]; history_note: string
  stages: {id: string; name: string; duration: number; day_type: string; version: number; alerts: number[]; buckets: Partial<Record<DeadlineStatus,number>>}[]
  month: {received: number; resolved: number}
}
export function useDeadlineDashboard(module: 'all' | 'quejas') {
  return useQuery({ queryKey: [...queryKeys.dashboard,'deadlines',module], queryFn: async ({signal}) => {
    const {data,error} = await supabase.rpc('qms_dashboard',{p_module:module}).abortSignal(signal)
    if (error) throw error
    return data as DeadlineDashboard
  }, staleTime: 30000, refetchInterval: 60000, refetchIntervalInBackground: false })
}
