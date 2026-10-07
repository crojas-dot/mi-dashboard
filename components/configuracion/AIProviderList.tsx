'use client'

import { useState } from 'react'
import { Play, RefreshCw, Wifi, RotateCcw, Trash2, CheckCircle, XCircle } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import type { AIProvider } from '@/lib/ai/types'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/Modal'

type TestStatus = 'pendiente' | 'probando' | 'ok' | 'fallo'
interface Props {
  providers: AIProvider[]
  syncingModels: ReadonlySet<string>
  testProviderId: string | null
  testInProgress: boolean
  testProgress: Record<string, TestStatus>
  onTest: (id: string) => void
  onSync: (id: string) => void
  onEdit: (provider: AIProvider) => void
  onDelete: (id: string) => void
  onConnect: (id: string) => void
  onReset: (id: string) => void
}

const fmtNum = new Intl.NumberFormat('es-ES')

/** Presentación del listado. Las pruebas, guardados y consultas siguen en el gestor. */
export default function AIProviderList({ providers, syncingModels, testProviderId, testInProgress, testProgress, onTest, onSync, onEdit, onDelete, onConnect, onReset }: Props) {
  const [modelProviderId, setModelProviderId] = useState<string | null>(null)
  const modelProvider = providers.find(provider => provider.id === modelProviderId)

  return <>
    <div className="ui-panel overflow-x-auto">
      <table className="w-full min-w-[680px] table-fixed select-text text-sm text-gray-700">
        <thead className="bg-qms-table-head">
          <tr>
            <th scope="col" className="w-[18%] px-3 py-3 text-left font-semibold">Proveedor</th>
            <th scope="col" className="w-[18%] px-3 py-3 text-left font-semibold">Modelos</th>
            <th scope="col" className="w-[24%] px-3 py-3 text-left font-semibold">Consumo / Límite</th>
            <th scope="col" className="w-[40%] px-3 py-3 text-left font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {providers.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-qms-muted">No hay proveedores configurados todavía.</td></tr> : providers.map(provider => {
            const modelos = provider.modelos ?? []
            const usados = provider.tokens_usados ?? 0
            const limite = provider.limite_tokens ?? 100000
            const pct = limite > 0 ? Math.min(100, Math.round((usados / limite) * 100)) : 0
            const colorBarra = pct > 90 ? 'bg-qms-danger' : pct >= 70 ? 'bg-qms-warning' : 'bg-qms-success'
            return <tr key={provider.id} className="h-32 border-b border-qms-border bg-qms-surface hover:bg-qms-hover-bg last:border-b-0">
              <td className="px-3 py-3 align-middle">
                <p className="truncate font-medium text-gray-900" title={provider.nombre}>{provider.nombre}</p>
                <div className="mt-2"><Badge variant="blue">{provider.tipo}</Badge></div>
              </td>
              <td className="px-3 py-3 align-middle">
                <Button size="sm" variant="link" disabled={modelos.length === 0} className="px-0!" onClick={() => setModelProviderId(provider.id)} aria-label={`Ver modelos de ${provider.nombre}`}>
                  {modelos.length} {modelos.length === 1 ? 'modelo' : 'modelos'}
                </Button>
                <p className="mt-1 truncate text-xs text-qms-muted" title={modelos[0]}>{modelos[0] || 'Sin modelos sincronizados'}</p>
              </td>
              <td className="px-3 py-3 align-middle">
                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span className="truncate" title={`${fmtNum.format(usados)} / ${fmtNum.format(limite)} tokens`}>{fmtNum.format(usados)} / {fmtNum.format(limite)}</span>
                  <span className="shrink-0 text-qms-muted">{pct}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-label={`Consumo de ${provider.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className={`${colorBarra} h-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                </div>
              </td>
              <td className="px-3 py-3 align-middle">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Acciones de ${provider.nombre}`}>
                  <Button size="sm" variant="secondary" onClick={() => onTest(provider.id)} disabled={syncingModels.has(provider.id) || modelos.length === 0} title="Testear modelos con prompts de prueba">
                    <Play className="h-3.5 w-3.5" aria-hidden="true" /> Testear
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onSync(provider.id)} disabled={syncingModels.has(provider.id) || testInProgress && testProviderId === provider.id} title="Sincronizar modelos desde el proveedor">
                    {syncingModels.has(provider.id) ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />} Sincronizar
                  </Button>
                  <Button size="sm" variant="link" onClick={() => onEdit(provider)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => onConnect(provider.id)} title="Probar conexión con el proveedor">
                    <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> Conexión
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onReset(provider.id)} title="Reiniciar contador de consumo">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reiniciar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => onDelete(provider.id)} aria-label={`Eliminar ${provider.nombre}`} title="Eliminar proveedor">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
    <Modal open={!!modelProvider} onClose={() => setModelProviderId(null)} title={`Modelos — ${modelProvider?.nombre ?? ''}`} size="lg">
      <p className="mb-3 text-sm text-qms-muted">{modelProvider?.modelos.length ?? 0} modelos disponibles</p>
      <ul className="max-h-[55dvh] overflow-y-auto rounded-card border border-qms-border bg-qms-surface">
        {modelProvider?.modelos.map(modelo => {
          const status = testProviderId === modelProvider.id ? testProgress[modelo] : undefined
          return <li key={modelo} className="flex items-center gap-2 border-b border-qms-border px-3 py-3 text-sm last:border-b-0">
            {status === 'probando' && <span role="status" className="inline-flex shrink-0 items-center"><Spinner className="text-qms-primary" /><span className="sr-only">Probando</span></span>}
            {status === 'ok' && <CheckCircle className="h-4 w-4 shrink-0 text-qms-success" aria-label="Prueba correcta" />}
            {status === 'fallo' && <XCircle className="h-4 w-4 shrink-0 text-qms-danger" aria-label="Prueba fallida" />}
            <span className="min-w-0 select-text break-all text-gray-700">{modelo}</span>
          </li>
        })}
      </ul>
    </Modal>
  </>
}
