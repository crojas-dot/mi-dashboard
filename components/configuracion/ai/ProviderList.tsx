'use client'

import { useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Loader2, Wifi, RefreshCw, Play, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import type { AIProvider, AIProviderTipo } from '@/lib/ai/types'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { ProviderFormModal } from './ProviderFormModal'
import { ModelTestModal } from './ModelTestModal'
import { sincronizarModelos, probarConexion, reiniciarContador, eliminarProveedor, getLimitePorTipo } from './actions'
import { fmtNum } from './constants'

interface ProviderListProps {
  providers: AIProvider[]
  onProvidersChange: (providers: AIProvider[]) => void
  onOpenFormModal: (provider?: AIProvider) => void
  onOpenTestModal: (providerId: string) => void
  syncingModels: Set<string>
  testModalProviderId: string | null
  testModalProgreso: Record<string, 'pendiente' | 'probando' | 'ok' | 'fallo'>
}

export function ProviderList({
  providers,
  onProvidersChange,
  onOpenFormModal,
  onOpenTestModal,
  syncingModels,
  testModalProviderId,
  testModalProgreso,
}: ProviderListProps) {
  const [mostrarKey, setMostrarKey] = useState<Record<string, boolean>>({})

  const handleProbarConexion = async (providerId: string) => {
    await probarConexion(providerId, providers, onProvidersChange)
  }

  const handleSincronizarModelos = async (providerId: string) => {
    await sincronizarModelos(providerId, providers, onProvidersChange)
  }

  const handleReiniciarContador = async (id: string) => {
    await reiniciarContador(id, providers, onProvidersChange)
  }

  const handleEliminar = async (id: string) => {
    await eliminarProveedor(id, providers, onProvidersChange)
  }

  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-border">
        <div className="p-8 text-center text-gray-500">
          No hay proveedores configurados todavía.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full select-text text-sm">
          <thead>
            <tr className="bg-header text-white">
              <th className="px-3 py-2 text-left font-semibold">Nombre</th>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">URL Base</th>
              <th className="px-3 py-2 text-left font-semibold">Modelos</th>
              <th className="px-3 py-2 text-left font-semibold">API Key</th>
              <th className="px-3 py-2 text-left font-semibold">Consumo / Límite</th>
              <th className="px-3 py-2 text-center font-semibold w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const visible = mostrarKey[p.id]
              const usados = p.tokens_usados ?? 0
              const limite = p.limite_tokens ?? 100000
              const pct = limite > 0 ? Math.min(100, Math.round((usados / limite) * 100)) : 0
              const colorBarra = pct > 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'
              const colorTexto = pct > 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-green-600'
              const isSyncing = syncingModels.has(p.id)
              const isTesting = testModalProviderId === p.id

              return (
                <tr key={p.id} className="border-b border-border/50 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-3 py-2">
                    <Badge variant="blue">{p.tipo}</Badge>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.base_url || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      {(p.modelos ?? []).length > 0 ? (
                        (p.modelos as string[]).slice(0, 5).map((modelo) => {
                          const testStatus = isTesting ? testModalProgreso[modelo] : undefined
                          return (
                            <span key={modelo} className="font-mono text-xs text-gray-600 flex items-center gap-1">
                              {testStatus === 'probando' && <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-500" />}
                              {testStatus === 'ok' && <CheckCircle className="h-2.5 w-2.5 text-green-500" />}
                              {testStatus === 'fallo' && <XCircle className="h-2.5 w-2.5 text-red-500" />}
                              {modelo}
                            </span>
                          )
                        })
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      {(p.modelos ?? []).length > 5 && (
                        <span className="text-xs text-gray-400">+{(p.modelos as string[]).length - 5} más</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-gray-500">
                        {visible ? p.api_key : '••••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMostrarKey((m) => ({ ...m, [p.id]: !m[p.id] }))}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        title={visible ? 'Ocultar' : 'Mostrar'}
                      >
                        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-36 h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div className={`${colorBarra} h-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs font-mono ${colorTexto} whitespace-nowrap`}>
                        {fmtNum.format(usados)} / {fmtNum.format(limite)} ({pct}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleProbarConexion(p.id)}
                        className="rounded p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Probar conexión y actualizar consumo"
                      >
                        <Wifi className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReiniciarContador(p.id)}
                        className="rounded p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
                        title="Reiniciar contador"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenTestModal(p.id)}
                        disabled={isSyncing || p.modelos.length === 0}
                        className="rounded p-1 text-gray-400 hover:text-purple-600 transition-colors disabled:opacity-50"
                        title="Testear modelos con prompts de prueba"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSincronizarModelos(p.id)}
                        disabled={isSyncing}
                        className="rounded p-1 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                        title="Sincronizar modelos desde el proveedor"
                      >
                        {isSyncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onOpenFormModal(p)}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(p.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 inline" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}