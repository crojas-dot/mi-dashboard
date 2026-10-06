'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import { retryRead } from '@/lib/errors/userError'
import { DEFAULT_TIME_ZONE, partesEnZona } from '@/lib/timeZone'

export interface FilaQuejaAnalisis {
  id: string
  folio: string
  cliente_nombre?: string | null
  prioridad?: string | null
  categoria?: string | null
  tipo?: string | null
  estado: string
  fecha: string
  fecha_cierre?: string | null
  fecha_sla?: string | null
}

export interface MesSerie { mes: string; recibidas: number; resueltas: number }
export interface Conteo { etiqueta: string; total: number }
export interface QuejasAnalisisData {
  anio: number
  series: MesSerie[]
  porEstado: Conteo[]
  porCategoria: Conteo[]
  activas: FilaQuejaAnalisis[]
  atencion: FilaQuejaAnalisis[]
}

export const quejasAnalisisKey = [...queryKeys.quejas, 'analisis'] as const
const TERMINALES = new Set(['Finalizado', 'Cerrada', 'No Procede'])
const TAMANO_PAGINA = 1000

function mesYAnio(fecha: string | null | undefined, zona: string) {
  if (!fecha) return null
  // Un campo DATE ya es un día civil: convertirlo a UTC movería el mes en Costa Rica.
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { anio: Number(fecha.slice(0, 4)), mes: Number(fecha.slice(5, 7)) }
  }
  const instante = new Date(fecha)
  return Number.isFinite(instante.getTime()) ? partesEnZona(instante, zona) : null
}

/** Paginar evita que el límite por defecto del Data API deje el gráfico incompleto. */
async function leerPaginas<T>(crear: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, signal?: AbortSignal): Promise<T[]> {
  const acumuladas: T[] = []
  for (let pagina = 0; ; pagina++) {
    if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError')
    const { data, error } = await crear(pagina * TAMANO_PAGINA, (pagina + 1) * TAMANO_PAGINA - 1)
    if (error) throw error
    acumuladas.push(...(data ?? []))
    if ((data?.length ?? 0) < TAMANO_PAGINA) return acumuladas
  }
}

export async function fetchQuejasAnalisis(zona = DEFAULT_TIME_ZONE, anio = partesEnZona(new Date(), zona).anio, signal?: AbortSignal): Promise<QuejasAnalisisData> {
  // Margen de un día UTC a ambos lados; el filtro preciso se hace luego en la
  // zona elegida. Así se incluyen los cambios de año cercanos a medianoche.
  const desde = new Date(Date.UTC(anio - 1, 11, 31)).toISOString()
  const hasta = new Date(Date.UTC(anio + 1, 0, 2)).toISOString()
  const [recibidas, cierres] = await Promise.all([
    leerPaginas<FilaQuejaAnalisis>((inicio, fin) => {
      let consulta = supabase.from('quejas')
      .select('id, folio, cliente_nombre, prioridad, categoria, tipo, estado, fecha, fecha_cierre, fecha_sla')
      .gte('fecha', desde).lt('fecha', hasta).order('fecha').order('id').range(inicio, fin)
      if (signal) consulta = consulta.abortSignal(signal)
      return consulta
    }, signal),
    // Una queja creada en otro año puede cerrarse en este. Consultar cierres
    // independientemente para no atribuirlos al año de recepción.
    leerPaginas<{ id: string; fecha_cierre: string }>((inicio, fin) => {
      let consulta = supabase.from('quejas').select('id, fecha_cierre')
        .gte('fecha_cierre', desde).lt('fecha_cierre', hasta)
        .order('fecha_cierre').order('id').range(inicio, fin)
      if (signal) consulta = consulta.abortSignal(signal)
      return consulta
    }, signal),
  ])

  const hoy = partesEnZona(new Date(), zona)
  const ultimoMes = anio === hoy.anio ? hoy.mes : 12
  const series: MesSerie[] = Array.from({ length: ultimoMes }, (_, i) => ({
    mes: new Intl.DateTimeFormat('es-CR', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(anio, i, 1))).replace('.', '').replace(/^./, (letra) => letra.toUpperCase()),
    recibidas: 0, resueltas: 0,
  }))
  const filas = recibidas.filter((fila) => {
    const fecha = mesYAnio(fila.fecha, zona)
    if (fecha?.anio !== anio || fecha.mes > ultimoMes) return false
    series[fecha.mes - 1].recibidas += 1
    return true
  })
  for (const cierre of cierres) {
    const fecha = mesYAnio(cierre.fecha_cierre, zona)
    if (fecha?.anio === anio && fecha.mes <= ultimoMes) series[fecha.mes - 1].resueltas += 1
  }

  const estados = new Map<string, number>()
  const tipos = new Map<string, number>()
  for (const fila of filas) {
    const estado = fila.estado?.trim() || 'Sin estado'
    const tipo = fila.tipo?.trim() || fila.categoria?.trim() || 'Sin tipo'
    estados.set(estado, (estados.get(estado) ?? 0) + 1)
    tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1)
  }
  const ordenar = (mapa: Map<string, number>): Conteo[] => [...mapa.entries()]
    .map(([etiqueta, total]) => ({ etiqueta, total })).sort((a, b) => b.total - a.total)
  // Nombre de propiedad histórico: su contenido ya representa el tipo real.
  const porCategoria = ordenar(tipos)
  const categoriasVisibles = porCategoria.length > 6
    ? [...porCategoria.slice(0, 6), { etiqueta: 'Otras', total: porCategoria.slice(6).reduce((suma, item) => suma + item.total, 0) }]
    : porCategoria
  const activas = filas.filter((fila) => !TERMINALES.has(fila.estado)).sort((a, b) => {
    if (!a.fecha_sla) return b.fecha_sla ? 1 : a.folio.localeCompare(b.folio)
    if (!b.fecha_sla) return -1
    return new Date(a.fecha_sla).getTime() - new Date(b.fecha_sla).getTime()
  })
  return { anio, series, porEstado: ordenar(estados), porCategoria: categoriasVisibles,
    activas, atencion: activas.slice(0, 8) }
}

export function useQuejasAnalisis(zona: string | undefined, anio: number) {
  return useQuery({
    queryKey: [...quejasAnalisisKey, zona, anio],
    queryFn: ({ signal }) => fetchQuejasAnalisis(zona, anio, signal),
    enabled: Boolean(zona),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: retryRead,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}
