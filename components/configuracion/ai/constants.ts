export const MODULOS_QMS: { id: string; label: string }[] = [
  { id: 'quejas', label: 'Quejas' },
  { id: 'sacp', label: 'SACP (Acciones)' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'auditorias', label: 'Auditorías' },
  { id: 'riesgos', label: 'Riesgos' },
  { id: 'revision', label: 'Revisión Dirección' },
  { id: 'general', label: 'General' },
]

export const AI_PROVIDER_TIPOS: { value: 'gemini' | 'anthropic' | 'openai'; label: string }[] = [
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'Estándar OpenAI (OpenAI, DeepSeek, Grok, OpenRouter…)' },
]

export const LIMITE_POR_TIPO: Record<'gemini' | 'anthropic' | 'openai', number> = {
  gemini: 30_000_000,
  anthropic: 250_000,
  openai: 6_000_000,
}

export const CLAVE_PROVEEDORES = 'ai_providers'
export const CLAVE_ROUTING = 'ai_routing'

export const fmtNum = new Intl.NumberFormat('es-ES')