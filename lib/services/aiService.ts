import { supabase } from '@/lib/supabase'

export interface AnalisisIAPayload {
  modulo: string
  entidad_id: string
  tipo_consulta: 'auto' | 'custom'
  prompt_usuario?: string
}

export async function analizarIA(payload: AnalisisIAPayload): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token ?? ''
  const res = await fetch('/api/ai/analizar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.error || 'Error de análisis IA')
  }
  return String(json.analisis ?? '')
}
