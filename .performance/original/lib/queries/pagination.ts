import { supabase } from '@/lib/supabase'

export const PAGE_SIZE = 25
export interface Pagina<T> { data: T[]; count: number }
export function paginaKey(base: readonly unknown[], page = 0, estado = '') {
  return [...base, 'pagina', page, estado] as const
}

export async function fetchPagina<T>(tabla: string, orden: string, page = 0, estado = ''): Promise<Pagina<T>> {
  const desde = Math.max(0, Math.floor(page)) * PAGE_SIZE
  let query = supabase.from(tabla).select('*', { count: 'exact' })
  if (estado) query = query.eq('estado', estado)
  const { data, count, error } = await query.order(orden, { ascending: false, nullsFirst: false })
    .order('id', { ascending: true }).range(desde, desde + PAGE_SIZE - 1)
  if (error) throw error
  return { data: (data as T[]) ?? [], count: count ?? 0 }
}
