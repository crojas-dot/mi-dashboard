import { supabase } from '@/lib/supabase'
import { CONFIG_INFORMES, TAMANO_LOTE_INFORME, MAX_REGISTROS_INFORME } from './configuracion'
import type { CatalogoItem, FilaInforme, FiltrosInforme } from './tipos'

/** Solo se llama desde el paso de filtros; no precargar catálogos de todos los módulos. */
export async function fetchCatalogosInforme(modulo: string, signal?: AbortSignal) {
  const tipos = CONFIG_INFORMES[modulo]?.catalogos ?? {}
  const catalogo = async (tipo?: string): Promise<CatalogoItem[]> => {
    if (!tipo) return []
    const query = supabase.from('catalogos').select('valor,color').eq('tipo', tipo).eq('modulo', modulo)
      .or('activo.is.null,activo.eq.true').order('orden')
    const { data, error } = await (signal ? query.abortSignal(signal) : query)
    if (error) throw error
    return (data ?? []) as CatalogoItem[]
  }
  const [estados, prioridades, tiposCatalogo] = await Promise.all([
    catalogo(tipos.estado), catalogo(tipos.prioridad), catalogo(tipos.tipo),
  ])
  return { estados, prioridades, tipos: tiposCatalogo }
}

/** Lectura existente por lotes; el tope requiere ajustar filtros, nunca truncar en silencio. */
export async function fetchFilasInforme(modulo: string, filtros: FiltrosInforme, signal?: AbortSignal): Promise<FilaInforme[]> {
  const config = CONFIG_INFORMES[modulo]
  if (!config) return []
  const filas: FilaInforme[] = []
  for (let desde = 0; ; desde += TAMANO_LOTE_INFORME) {
    signal?.throwIfAborted()
    let query = supabase.from(config.tabla).select('*', { count: 'exact' })
    if (filtros.fechaDesde) query = query.gte(config.campoFecha, filtros.fechaDesde)
    if (filtros.fechaHasta) {
      const siguiente = new Date(filtros.fechaHasta + 'T00:00:00Z')
      siguiente.setUTCDate(siguiente.getUTCDate() + 1)
      query = query.lt(config.campoFecha, siguiente.toISOString().slice(0, 10))
    }
    if (filtros.estado) query = query.eq('estado', filtros.estado)
    if (filtros.prioridad && modulo === 'quejas') query = query.eq('prioridad', filtros.prioridad)
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
    query = query.order('id').range(desde, desde + TAMANO_LOTE_INFORME - 1)
    const { data, error, count } = await (signal ? query.abortSignal(signal) : query)
    if (error) throw error
    if ((count ?? 0) > MAX_REGISTROS_INFORME) throw new Error('El informe supera 5000 registros. Ajustá las fechas o filtros para generarlo.')
    const batch = (data ?? []) as FilaInforme[]
    filas.push(...batch)
    if (batch.length < TAMANO_LOTE_INFORME || filas.length >= (count ?? Infinity)) break
  }
  return filas
}
