import type { AIProvider } from '@/lib/ai/types'

// El borrador admite texto de modelos; el transporte siempre recibe string[].
export interface EditingProvider extends Omit<AIProvider, 'modelos'> { modelos: string | string[] }
export interface ModelTestState {
  abierto: boolean; providerId: string | null; providerNombre: string; modelos: string[]
  progreso: Record<string, 'pendiente' | 'probando' | 'ok' | 'fallo'>
  enCurso: boolean; cancelado: boolean
  resultado: { buenos: number; malos: number; total: number } | null
}
