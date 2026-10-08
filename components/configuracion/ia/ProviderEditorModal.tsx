import type { Dispatch, SetStateAction } from 'react'
import { KeyRound, Wifi, Save } from 'lucide-react'
import type { AIProviderTipo } from '@/lib/ai/types'
import type { EditingProvider } from './types'
import { TIPOS_PROVEEDOR, limitePorTipo } from './configuracion'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'

interface Props {
  editingProvider: EditingProvider | null
  setEditingProvider: Dispatch<SetStateAction<EditingProvider | null>>
  guardandoProveedor: boolean
  cerrarEditor: () => void
  probarConexion: (providerId?: string) => Promise<void>
  aplicarForm: () => Promise<void>
}

/** Formulario controlado: no consulta secretos ni persiste configuración. */
export default function ProviderEditorModal({ editingProvider, setEditingProvider, guardandoProveedor, cerrarEditor, probarConexion, aplicarForm }: Props) {
  return (
    <Modal
      open={!!editingProvider}
      onClose={cerrarEditor}
      title={editingProvider?.id && editingProvider.id !== '' ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      size="lg"
    >
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-qms-dark">Datos del Proveedor</h3>
        <fieldset disabled={guardandoProveedor} aria-label="Datos del Proveedor" className="grid gap-4 sm:grid-cols-2">
          <Field id="ai-provider-name" label="Nombre *" className="sm:col-span-2">
            <Input
              id="ai-provider-name"
              placeholder="Ej: Grok xAI"
              value={editingProvider?.nombre ?? ''}
              onChange={(e) => setEditingProvider({ ...editingProvider!, nombre: e.target.value })}
            />
          </Field>
          <Field id="ai-provider-type" label="Tipo de API *">
            <Select id="ai-provider-type" value={editingProvider?.tipo ?? 'openai'} onChange={(e) => {
              const nuevoTipo = e.target.value as AIProviderTipo
              setEditingProvider({ ...editingProvider!, tipo: nuevoTipo, limite_tokens: limitePorTipo(nuevoTipo) })
            }}>
              {TIPOS_PROVEEDOR.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field id="ai-provider-token-limit" label="Límite de Tokens">
            <Input
              id="ai-provider-token-limit"
              type="number"
              min="1"
              value={editingProvider?.limite_tokens ?? 100000}
              onChange={(e) => setEditingProvider({ ...editingProvider!, limite_tokens: parseInt(e.target.value) || 100000 })}
            />
          </Field>
          {editingProvider?.tipo === 'openai' && (
            <Field id="ai-provider-base-url" label="URL Base (opcional)" className="sm:col-span-2">
              <Input
                id="ai-provider-base-url"
                placeholder="https://api.x.ai/v1"
                value={editingProvider?.base_url ?? ''}
                onChange={(e) => setEditingProvider({ ...editingProvider!, base_url: e.target.value })}
              />
            </Field>
          )}
          <Field id="ai-provider-models" label="Modelos disponibles (opcional)" hint="Separados por comas. Si queda vacío, se intentan sincronizar al guardar." className="sm:col-span-2">
            <Input
              id="ai-provider-models"
              aria-describedby="ai-provider-models-hint"
              placeholder="ej. modelo-1, modelo-2"
              value={Array.isArray(editingProvider?.modelos) ? editingProvider.modelos.join(', ') : editingProvider?.modelos ?? ''}
              onChange={(e) => setEditingProvider({ ...editingProvider!, modelos: e.target.value.split(',').map(m => m.trimStart()) })}
            />
          </Field>
          <Field id="ai-provider-api-key" label={editingProvider?.has_api_key ? 'API Key (opcional al editar)' : 'API Key *'} className="sm:col-span-2">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-qms-muted" aria-hidden="true" />
              <Input
                id="ai-provider-api-key"
                type="password"
                autoComplete="off"
                aria-label="Clave de API del proveedor"
                className="pl-10"
                placeholder={editingProvider?.has_api_key ? 'Dejar vacío para conservar la clave' : 'Clave del proveedor'}
                value={editingProvider?.api_key ?? ''}
                onChange={(e) => setEditingProvider({ ...editingProvider!, api_key: e.target.value })}
              />
            </div>
          </Field>
        </fieldset>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-qms-border pt-4">
          <Button size="sm" variant="secondary" disabled={guardandoProveedor} onClick={cerrarEditor}>
            Cancelar
          </Button>
          <Button size="sm" variant="secondary" disabled={guardandoProveedor} onClick={() => probarConexion()}>
            <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> Probar Conexión
          </Button>
          <Button size="sm" loading={guardandoProveedor} onClick={aplicarForm}>
            <Save className="h-3.5 w-3.5" aria-hidden="true" /> {editingProvider?.id && editingProvider?.id !== '' ? 'Guardar Cambios' : 'Crear Proveedor'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
