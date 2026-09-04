export type AIProviderTipo = 'gemini' | 'anthropic' | 'openai'

export interface AIProvider {
  id: string
  nombre: string
  tipo: AIProviderTipo
  base_url?: string
  api_key: string
  tokens_usados: number
  limite_tokens: number
  modelos: string[]
  tokens_updated_at?: string
}

export interface AIRuta {
  proveedor_id: string
  modelo_nombre: string
  system_prompt?: string
  fallback_provider_id?: string
  fallback_modelo?: string
}

export type AIRouting = Record<string, AIRuta>

export interface ArchivoIA {
  nombre: string
  mime: string
  buffer: Buffer
}
