import type { AIProvider } from './types'
export function esOpenRouter(provider: Pick<AIProvider,'base_url'|'nombre'>): boolean {
  return (provider.base_url??'').toLowerCase().includes('openrouter.ai') || (provider.nombre??'').toLowerCase().includes('openrouter')
}
