import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/utils/logger'

const rpcByName = {
  queja: 'generar_folio_queja',
  sacp: 'generar_folio_sacp',
  auditoria: 'generar_folio_auditoria',
  riesgo: 'generar_folio_riesgo',
  documento: 'generar_folio_documento',
} as const

export type FolioTipo = keyof typeof rpcByName

export async function generarFolio(tipo: FolioTipo): Promise<string> {
  const { data, error } = await supabase.rpc(rpcByName[tipo])
  if (error) {
    logger.error('No se pudo generar el folio', { module: tipo, action: 'generate_folio' }, error)
    throw error
  }
  return (data as string) ?? ''
}
