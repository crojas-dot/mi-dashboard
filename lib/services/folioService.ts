import { supabase } from '@/lib/supabase'

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
    console.error(`Error al generar folio (${tipo}):`, error)
    throw error
  }
  return (data as string) ?? ''
}
