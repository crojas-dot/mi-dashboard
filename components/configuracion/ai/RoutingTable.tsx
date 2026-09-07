'use client'

import { Brain, Check, ChevronRight, Save } from 'lucide-react'
import type { AIProvider, AIRouting } from '@/lib/ai/types'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Modal from '@/components/Modal'
import Textarea from '@/components/ui/Textarea'
import { MODULOS_QMS } from './constants'

interface RoutingTableProps {
  routing: AIRouting
  providers: AIProvider[]
  onRoutingChange: (routing: AIRouting) => void
  expandedFallbacks: Set<string>
  onToggleFallback: (moduloId: string) => void
  onOpenContextModal: (moduloId: string) => void
  onSaveRouting: () => Promise<void>
  saving: boolean
}

export function RoutingTable({
  routing,
  providers,
  onRoutingChange,
  expandedFallbacks,
  onToggleFallback,
  onOpenContextModal,
  onSaveRouting,
  saving,
}: RoutingTableProps) {
  const actualizarRuta = (
    modulo: string,
    campo: 'proveedor_id' | 'modelo_nombre' | 'system_prompt' | 'fallback_provider_id' | 'fallback_modelo',
    valor: string
  ) => {
    const next = { ...routing, [modulo]: { ...routing[modulo], [campo]: valor } }
    if (campo === 'proveedor_id' && valor) {
      const prov = providers.find(p => p.id === valor)
      if (prov?.modelos?.length === 1) {
        next[modulo].modelo_nombre = prov.modelos[0]
      } else {
        next[modulo].modelo_nombre = ''
      }
    }
    if (campo === 'fallback_provider_id' && valor) {
      const fbProv = providers.find(p => p.id === valor)
      if (fbProv?.modelos?.length === 1) {
        next[modulo].fallback_modelo = fbProv.modelos[0]
      } else {
        next[modulo].fallback_modelo = ''
      }
    } else if (campo === 'fallback_provider_id' && !valor) {
      next[modulo].fallback_modelo = ''
    }
    onRoutingChange(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Enrutamiento por módulo</h3>
        <p className="mt-1 text-xs text-gray-500">
          Asigná qué proveedor y qué modelo exacto se usa en cada módulo del QMS.
        </p>

        <div className="mt-3 space-y-2">
          {MODULOS_QMS.map((m) => {
            const ruta = routing[m.id]
            const prov = providers.find(p => p.id === ruta?.proveedor_id)
            const fallbackProv = ruta?.fallback_provider_id ? providers.find(p => p.id === ruta.fallback_provider_id) : null
            const isExpanded = expandedFallbacks.has(m.id)

            return (
              <div key={m.id} className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-gray-50 p-3">
                  <span className="w-40 shrink-0 text-sm font-medium text-gray-700">{m.label}</span>
                  <Select
                    value={ruta?.proveedor_id ?? ''}
                    onChange={(e) => actualizarRuta(m.id, 'proveedor_id', e.target.value)}
                  >
                    <option value="">Sin proveedor</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
                    ))}
                  </Select>
                  {!prov ? (
                    <input
                      className="w-56 rounded-md border border-gray-300 bg-gray-100 px-2.5 py-1.5 text-sm text-gray-400"
                      placeholder="Elegí un proveedor primero"
                      disabled
                    />
                  ) : (
                    <Select
                      value={ruta?.modelo_nombre ?? ''}
                      onChange={(e) => actualizarRuta(m.id, 'modelo_nombre', e.target.value)}
                    >
                      <option value="">Seleccionar modelo</option>
                      {(prov.modelos?.length ?? 0) > 0 ? (
                        prov.modelos.map(mod => <option key={mod} value={mod}>{mod}</option>)
                      ) : (
                        <option value="" disabled>Sincronice modelos con el botón ↻</option>
                      )}
                    </Select>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenContextModal(m.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      ruta?.system_prompt?.trim()
                        ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                        : 'border-blue-600 text-blue-600 hover:bg-blue-50'
                    }`}
                    title="Definir el rol / system prompt de la IA para este módulo"
                  >
                    {ruta?.system_prompt?.trim() ? <Check className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
                    {ruta?.system_prompt?.trim() ? 'Especializado' : 'Especializar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFallback(m.id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Configurar proveedor de respaldo (fallback)"
                  >
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    Respaldo
                  </button>
                </div>
                {isExpanded && (
                  <div className="ml-11 mt-2 pt-2 border-t border-border space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-xs font-medium text-gray-500">Respaldo (Fallback)</span>
                      <Select
                        value={routing[m.id]?.fallback_provider_id ?? ''}
                        onChange={(e) => actualizarRuta(m.id, 'fallback_provider_id', e.target.value)}
                      >
                        <option value="">Sin proveedor de respaldo</option>
                        {providers.filter(p => p.id !== routing[m.id]?.proveedor_id).map(p => (
                          <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
                        ))}
                      </Select>
                      {routing[m.id]?.fallback_provider_id && (
                        <Select
                          value={routing[m.id]?.fallback_modelo ?? ''}
                          onChange={(e) => actualizarRuta(m.id, 'fallback_modelo', e.target.value)}
                        >
                          <option value="">Seleccionar modelo</option>
                          {fallbackProv?.modelos?.length ? (
                            fallbackProv.modelos.map(mod => <option key={mod} value={mod}>{mod}</option>)
                          ) : (
                            <option value="" disabled>Sincronice modelos con el botón ↻</option>
                          )}
                        </Select>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-3">
          <Button size="sm" onClick={onSaveRouting} loading={saving}>
            <Save className="h-3.5 w-3.5 mr-1" /> Guardar enrutamiento
          </Button>
        </div>
      </div>

      <Modal
        open={!!routing[Object.keys(routing).find(k => routing[k]?.system_prompt) ?? '']}
        onClose={() => {}}
        title=""
        size="md"
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Rol de la IA (System Prompt)</label>
          <textarea
            rows={10}
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            placeholder="Eres un auditor de calidad del ECA. Analizás quejas identificando riesgos ISO 9001, causas raíz y recomendaciones…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {}}>Cancelar</Button>
            <Button onClick={() => {}}>Guardar contexto</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}