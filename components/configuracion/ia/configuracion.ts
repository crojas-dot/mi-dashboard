import type { AIProviderTipo } from '@/lib/ai/types'

export const TIPOS_PROVEEDOR: readonly { value: AIProviderTipo; label: string }[] = [
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'Estándar OpenAI (OpenAI, DeepSeek, Grok, OpenRouter…)' },
]
const LIMITES: Record<AIProviderTipo, number> = { gemini: 30_000_000, anthropic: 250_000, openai: 6_000_000 }
export const limitePorTipo = (tipo: AIProviderTipo) => LIMITES[tipo] ?? 250_000

/** Orden estable y sin IDs duplicados: progreso y filas se identifican por modelo. */
export function modelosDelEditor(value: string | string[]): string[] {
  return [...new Set((Array.isArray(value) ? value : value.split(',')).map(modelo => modelo.trim()).filter(Boolean))]
}
