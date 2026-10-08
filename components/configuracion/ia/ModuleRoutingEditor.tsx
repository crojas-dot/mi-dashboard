import type { Dispatch, SetStateAction } from 'react'
import { Check, ChevronRight, Save } from 'lucide-react'
import type { AIProvider, AIRouting } from '@/lib/ai/types'
import { MODULOS_IA } from '@/lib/constants/modulos'
import type { CampoRutaIA } from './routing'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'

interface Props {
  providers: AIProvider[]; routing: AIRouting; expandedFallbacks: Set<string>
  setExpandedFallbacks: Dispatch<SetStateAction<Set<string>>>
  actualizarRuta: (modulo: string, campo: CampoRutaIA, valor: string) => void
  abrirModalContexto: (modulo: string) => void
  guardandoRut: boolean; guardarRouting: () => Promise<void>
}

export default function ModuleRoutingEditor({ providers, routing, expandedFallbacks, setExpandedFallbacks, actualizarRuta, abrirModalContexto, guardandoRut, guardarRouting }: Props) {
  // Índice local por ID: una búsqueda constante por fila, sin duplicar estado remoto.
  const providersById = new Map(providers.map(provider => [provider.id, provider]))
  return (
    <div className="mt-8">
      <h3 className="text-base font-medium text-qms-dark">Modelo por módulo</h3>
      <p className="mt-1 text-xs text-qms-muted">
        Elegí el proveedor y modelo principal. El respaldo se usa cuando el principal no responde.
      </p>

      <div className="mt-3 space-y-3">
        {MODULOS_IA.map((m) => {
          const ruta = routing[m.id]
          const prov = providersById.get(ruta?.proveedor_id ?? '')
          const fallbackProv = providersById.get(ruta?.fallback_provider_id ?? '')
          const id = 'ai-routing-' + m.id
          const especializado = !!ruta?.system_prompt?.trim()
          const respaldoAbierto = expandedFallbacks.has(m.id)
          return (
            <section key={m.id} aria-labelledby={id + '-title'} className="ui-panel min-w-0 space-y-3 p-3">
              <h4 id={id + '-title'} className="text-sm font-medium text-qms-dark">{m.label}</h4>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                <Field id={id + '-provider'} label="Proveedor principal">
                  <Select
                    id={id + '-provider'}
                    aria-label={'Proveedor principal para ' + m.label}
                    value={ruta?.proveedor_id ?? ''}
                    onChange={(e) => actualizarRuta(m.id, 'proveedor_id', e.target.value)}
                  >
                    <option value="">Sin proveedor</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
                    ))}
                  </Select>
                </Field>
                <Field id={id + '-model'} label="Modelo principal">
                  {!prov ? (
                    <Input
                      id={id + '-model'}
                      aria-label={'Modelo principal para ' + m.label}
                      placeholder="Elegí un proveedor primero"
                      disabled
                    />
                  ) : (
                    <Select
                      id={id + '-model'}
                      aria-label={'Modelo principal para ' + m.label}
                      value={ruta?.modelo_nombre ?? ''}
                      onChange={(e) => actualizarRuta(m.id, 'modelo_nombre', e.target.value)}
                    >
                      <option value="">Seleccionar modelo</option>
                      {(prov.modelos?.length ?? 0) > 0 ? (
                        prov.modelos.map((mod) => <option key={mod} value={mod}>{mod}</option>)
                      ) : (
                        <option value="" disabled>Sincronice modelos con el botón ↻</option>
                      )}
                    </Select>
                  )}
                </Field>
                <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1">
                  <button
                    type="button"
                    onClick={() => abrirModalContexto(m.id)}
                    className={'ui-button ui-button-sm ' + (especializado
                      ? 'border-qms-success bg-qms-success text-white hover:bg-qms-success/90'
                      : 'border-qms-primary text-qms-primary hover:bg-qms-primary-soft')}
                    aria-label={(especializado ? 'Editar especialización de IA para ' : 'Especializar IA para ') + m.label}
                    title="Definir el rol / system prompt de la IA para este módulo"
                  >
                    {especializado && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    {especializado ? 'Especializado' : 'Especializar'}
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setExpandedFallbacks(prev => {
                      const next = new Set(prev)
                      if (next.has(m.id)) next.delete(m.id)
                      else next.add(m.id)
                      return next
                    })}
                    aria-label={'Configurar respaldo para ' + m.label}
                    aria-expanded={respaldoAbierto}
                    aria-controls={id + '-fallback'}
                    title="Configurar proveedor de respaldo (fallback)"
                  >
                    <ChevronRight className={'h-3.5 w-3.5 transition-transform ' + (respaldoAbierto ? 'rotate-90' : '')} aria-hidden="true" />
                    Respaldo
                  </Button>
                </div>
              </div>
              {respaldoAbierto && (
                <div id={id + '-fallback'} className="grid min-w-0 gap-3 border-t border-qms-border pt-3 sm:grid-cols-2">
                  <Field id={id + '-fallback-provider'} label="Proveedor de respaldo">
                    <Select
                      id={id + '-fallback-provider'}
                      aria-label={'Proveedor de respaldo para ' + m.label}
                      value={ruta?.fallback_provider_id ?? ''}
                      onChange={(e) => actualizarRuta(m.id, 'fallback_provider_id', e.target.value)}
                    >
                      <option value="">Sin proveedor de respaldo</option>
                      {providers.filter(p => p.id !== ruta?.proveedor_id).map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>
                      ))}
                    </Select>
                  </Field>
                  {ruta?.fallback_provider_id && (
                    <Field id={id + '-fallback-model'} label="Modelo de respaldo">
                      <Select
                        id={id + '-fallback-model'}
                        aria-label={'Modelo de respaldo para ' + m.label}
                        value={ruta?.fallback_modelo ?? ''}
                        onChange={(e) => actualizarRuta(m.id, 'fallback_modelo', e.target.value)}
                      >
                        <option value="">Seleccionar modelo</option>
                        {!fallbackProv ? <option value="" disabled>Primero elegí un proveedor</option> : (
                          (fallbackProv.modelos?.length ?? 0) > 0 ? (
                            fallbackProv.modelos.map((mod) => <option key={mod} value={mod}>{mod}</option>)
                          ) : (
                            <option value="" disabled>Sincronice modelos con el botón ↻</option>
                          )
                        )}
                      </Select>
                    </Field>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="mt-3">
        <Button size="sm" onClick={guardarRouting} loading={guardandoRut}>
          <Save className="h-3.5 w-3.5" aria-hidden="true" /> Guardar enrutamiento
        </Button>
      </div>
    </div>
  )
}
