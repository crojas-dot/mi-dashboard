'use client'

import { useRef, useState } from 'react';
import { Wifi, Save, KeyRound, Loader2 } from 'lucide-react';
import type { AIProvider, AIProviderTipo } from '@/lib/ai/types';
import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select'
import { showError, showSuccess } from '@/lib/services/errorToast';
import { getLimitePorTipo } from './actions';
import { AI_PROVIDER_TIPOS } from './constants';

interface EditingProvider extends Omit<AIProvider, 'modelos'> {
  modelos: string | string[]
}

interface ProviderFormModalProps {
  open: boolean
  editingProvider: EditingProvider | null
  providers: AIProvider[]
  onClose: () => void
  onSave: (provider: AIProvider, isNew: boolean) => Promise<void>
  onTestConnection: (providerId: string) => void
}

export function ProviderFormModal({
  open,
  editingProvider,
  onClose,
  onSave,
}: ProviderFormModalProps) {
  const [formData, setFormData] = useState<EditingProvider>(() => {
    if (editingProvider) {
      return {
        ...editingProvider,
        modelos: Array.isArray(editingProvider.modelos) ? editingProvider.modelos.join(', ') : editingProvider.modelos,
      }
    }
    return {
      id: '',
      nombre: '',
      tipo: 'openai',
      base_url: '',
      api_key: '',
      modelos: '',
      tokens_usados: 0,
      limite_tokens: getLimitePorTipo('openai'),
    }
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const prevEditingId = useRef(editingProvider?.id ?? '')
  if ((editingProvider?.id ?? '') !== prevEditingId.current) {
    prevEditingId.current = editingProvider?.id ?? ''
    if (editingProvider) {
      setFormData({
        ...editingProvider,
        modelos: Array.isArray(editingProvider.modelos) ? editingProvider.modelos.join(', ') : editingProvider.modelos,
      })
    } else {
      setFormData({
        id: '',
        nombre: '',
        tipo: 'openai',
        base_url: '',
        api_key: '',
        modelos: '',
        tokens_usados: 0,
        limite_tokens: getLimitePorTipo('openai'),
      })
    }
  }

  const handleChange = (field: keyof EditingProvider, value: string | number) => {
    if (field === 'modelos') {
      setFormData(prev => ({ ...prev, modelos: value as string }))
    } else if (field === 'tipo') {
      setFormData(prev => ({ ...prev, tipo: value as AIProviderTipo, limite_tokens: getLimitePorTipo(value as AIProviderTipo) }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleModelosChange = (value: string) => {
    const modelosArray = value.split(',').map(m => m.trim()).filter(Boolean)
    setFormData(prev => ({ ...prev, modelos: modelosArray }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre.trim() || !formData.api_key.trim()) {
      showError(null, 'Nombre y API Key son obligatorios')
      return
    }

    const modelosArray = (formData.modelos as string).split(',').map(m => m.trim()).filter(Boolean)
    const isNew = !formData.id || formData.id === ''

    const providerData: AIProvider = {
      id: formData.id || crypto.randomUUID(),
      nombre: formData.nombre.trim(),
      tipo: formData.tipo,
      base_url: formData.base_url?.trim() || undefined,
      api_key: formData.api_key.trim(),
      modelos: modelosArray,
      limite_tokens: formData.limite_tokens ?? 100000,
      tokens_usados: 0,
    }

    setSaving(true)
    try {
      await onSave(providerData, isNew)
      onClose()
    } catch (e) {
      showError(e as Error, 'No se pudo guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!formData.base_url?.trim() || !formData.api_key?.trim()) {
      showError(null, 'URL Base y API Key son requeridos para probar la conexión')
      return
    }
    setTesting(true)
    try {
      const base = formData.base_url.trim().replace(/\/+$/, '')
      const testUrl = formData.tipo === 'gemini'
        ? `${base}/v1beta/models?key=${formData.api_key}`
        : `${base}/models`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (formData.tipo !== 'gemini') headers['Authorization'] = `Bearer ${formData.api_key}`
      const res = await fetch(testUrl, { method: 'GET', headers, signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        showSuccess('Conexión exitosa ✓')
      } else {
        const err = await res.json().catch(() => ({}))
        showError(null, `Falló la conexión: ${res.status} ${err?.error?.message || res.statusText}`)
      }
    } catch (e) {
      showError(e as Error, 'No se pudo conectar con el proveedor')
    } finally {
      setTesting(false)
    }
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title={editingProvider?.id ? 'Editar Proveedor' : 'Nuevo Proveedor'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <h6 className="text-sm font-medium text-gray-700">Datos del Proveedor</h6>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 min-w-0">
              <Input
                label="Nombre *"
                placeholder="Ej: Grok xAI"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                required
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de API *</label>
              <Select
                value={formData.tipo}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('tipo', e.target.value)}
              >
                {AI_PROVIDER_TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div className="min-w-0">
              <Input
                label="Límite de Tokens"
                type="number"
                min="1"
                value={formData.limite_tokens}
                onChange={(e) => handleChange('limite_tokens', parseInt(e.target.value) || 100000)}
              />
            </div>
            {formData.tipo === 'openai' && (
              <div className="sm:col-span-2">
                <Input
                  label="URL Base (opcional)"
                  placeholder="https://api.x.ai/v1"
                  value={formData.base_url}
                  onChange={(e) => handleChange('base_url', e.target.value)}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Modelos Soportados *</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
                placeholder="ej. modelo-1, modelo-2"
                value={formData.modelos}
                onChange={(e) => handleModelosChange(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">Separados por coma: modelo-1, modelo-2</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key *</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={formData.id ? 'password' : 'text'}
                  className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="sk-..."
                  value={formData.api_key}
                  onChange={(e) => handleChange('api_key', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-end justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="secondary" onClick={handleTestConnection} disabled={saving || testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wifi className="h-3.5 w-3.5 mr-1" />}
              Probar Conexión
            </Button>
            <Button type="submit" disabled={saving} loading={saving}>
              <Save className="h-3.5 w-3.5 mr-1" /> {editingProvider?.id ? 'Guardar Cambios' : 'Crear Proveedor'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}