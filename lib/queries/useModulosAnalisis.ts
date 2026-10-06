'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import { retryRead } from '@/lib/errors/userError'
import { DEFAULT_TIME_ZONE, mesYAnioEnZona, mesesDelAnio, partesEnZona } from '@/lib/timeZone'

// Serie de solo lectura para los tabs SACP/Documentos/Riesgos del dashboard.
// No altera las consultas paginadas de los módulos operativos.

export interface SacpAnalisis {
  id: string
  folio?: string | null
  tipo: string
  descripcion?: string | null
  estado: string
  prioridad?: string | null
  fecha_limite?: string | null
  fecha_apertura?: string | null
  responsable_id?: string | null
}

export interface DocAnalisis {
  id: string
  codigo_doc?: string | null
  titulo: string
  version_actual?: string | null
  estado: string
  categoria?: string | null
  fecha_publicacion?: string | null
  created_at?: string | null
}

export interface VersionesAnalisis {
  cambios_documentales: { mes: string; total: number }[]
}

export interface RiesgoAnalisis {
  id: string
  folio?: string | null
  descripcion?: string | null
  categoria?: string | null
  nivel?: string | null
  estado?: string | null
  probabilidad: number
  impacto: number
  fecha_identificacion?: string | null
}

export const sacpAnalisisKey = [...queryKeys.acciones, 'analisis'] as const
export const documentosAnalisisKey = [...queryKeys.documentos, 'analisis'] as const
export const riesgosAnalisisKey = [...queryKeys.riesgos, 'analisis'] as const

export async function fetchSacpAnalisis(): Promise<SacpAnalisis[]> {
  const { data, error } = await supabase
    .from('acciones')
    .select('id, folio, tipo, descripcion, estado, prioridad, fecha_limite, fecha_apertura, responsable_id')
    .order('fecha_apertura', { ascending: false })
  if (error) throw error
  return (data ?? []) as SacpAnalisis[]
}

export function useSacpAnalisis() {
  return useQuery({
    queryKey: sacpAnalisisKey,
    queryFn: fetchSacpAnalisis,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: retryRead,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export async function fetchDocumentosAnalisis(): Promise<DocAnalisis[]> {
  const { data, error } = await supabase
    .from('documentos')
    .select('id, codigo_doc, titulo, version_actual, estado, categoria, fecha_publicacion, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DocAnalisis[]
}

/** Versiones reales del año civil configurado; se paginan para no truncar el gráfico. */
export async function fetchVersionesAnalisis(zona = DEFAULT_TIME_ZONE,
  anio = partesEnZona(new Date(), zona).anio, signal?: AbortSignal): Promise<VersionesAnalisis['cambios_documentales']> {
  const desde = new Date(Date.UTC(anio - 1, 11, 31)).toISOString()
  const hasta = new Date(Date.UTC(anio + 1, 0, 2)).toISOString()
  const calendario = mesesDelAnio(new Date(), zona)
  const meses = anio === calendario.anio ? calendario.meses : Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat('es-CR', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(anio, i, 1))).replace('.', '').replace(/^./, (letra) => letra.toUpperCase()))
  const conteos = Array<number>(meses.length).fill(0)
  for (let inicio = 0; ; inicio += 1000) {
    if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError')
    let consulta = supabase.from('versiones_documentos').select('id, fecha')
      .gte('fecha', desde).lt('fecha', hasta).order('fecha').order('id').range(inicio, inicio + 999)
    if (signal) consulta = consulta.abortSignal(signal)
    const { data, error } = await consulta
    if (error) throw error
    for (const fila of data ?? []) {
      const fecha = mesYAnioEnZona(fila.fecha, zona)
      if (fecha?.anio === anio && fecha.mes >= 1 && fecha.mes <= meses.length) conteos[fecha.mes - 1] += 1
    }
    if ((data?.length ?? 0) < 1000) break
  }
  return meses.map((mes, indice) => ({ mes, total: conteos[indice] }))
}

export function useDocumentosAnalisis() {
  return useQuery({
    queryKey: documentosAnalisisKey,
    queryFn: fetchDocumentosAnalisis,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: retryRead,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export function useVersionesAnalisis(zona: string | undefined, anio: number) {
  return useQuery({
    queryKey: [...documentosAnalisisKey, 'versiones', zona, anio],
    queryFn: ({ signal }) => fetchVersionesAnalisis(zona, anio, signal),
    enabled: Boolean(zona),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: retryRead,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export async function fetchRiesgosAnalisis(): Promise<RiesgoAnalisis[]> {
  const { data, error } = await supabase
    .from('riesgos')
    .select('id, folio, descripcion, categoria, nivel, estado, probabilidad, impacto, fecha_identificacion')
    .order('fecha_identificacion', { ascending: false })
  if (error) throw error
  return (data ?? []) as RiesgoAnalisis[]
}

export function useRiesgosAnalisis() {
  return useQuery({
    queryKey: riesgosAnalisisKey,
    queryFn: fetchRiesgosAnalisis,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: retryRead,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}
