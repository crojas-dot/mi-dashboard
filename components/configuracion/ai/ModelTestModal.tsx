'use client'

import { useState, useRef } from 'react';
import { Loader2, Play, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import type { AIProvider } from '@/lib/ai/types';
import Button from '@/components/ui/Button'
import Modal from '@/components/Modal'
import { ScrollArea } from '@/components/ui/ScrollArea';
import { showError, showSuccess } from '@/lib/services/errorToast';
import { supabase } from '@/lib/supabase';

interface TestProgress {
  [modelo: string]: 'pendiente' | 'probando' | 'ok' | 'fallo'
}

interface ModelTestModalProps {
  open: boolean
  provider: AIProvider | null
  onClose: () => void
  onTestComplete: (providerId: string, modelosOk: string[]) => void
}

export function ModelTestModal({ open, provider, onClose, onTestComplete }: ModelTestModalProps) {
  const [progreso, setProgreso] = useState<TestProgress>({})
  const [enCurso, setEnCurso] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [resultado, setResultado] = useState<{ buenos: number; malos: number; total: number } | null>(null)
  const testAbortRef = useRef<AbortController | null>(null)

  const initialProgreso = provider ? Object.fromEntries(provider.modelos.map(m => [m, 'pendiente' as const])) : {}

  const cerrarTestModal = () => {
    if (enCurso) testAbortRef.current?.abort()
    onClose()
    testAbortRef.current = null
  }

  const iniciarTest = async () => {
    if (!provider) return

    const abortController = new AbortController()
    testAbortRef.current = abortController

    setProgreso(initialProgreso)
    setEnCurso(true)
    setCancelado(false)
    setResultado(null)

    try {
      const { testearProveedor } = await import('@/lib/ai/modelTesting')

      const testResultado = await testearProveedor(supabase, provider, {
        maxModelos: 20,
        signal: abortController.signal,
        onProgress: (modelo: string, r: { ok: boolean }) => {
          setProgreso(prev => ({ ...prev, [modelo]: r.ok ? 'ok' : 'fallo' }))
        },
      })

      const buenos = testResultado.resultados.filter(r => r.ok).length
      const malos = testResultado.resultados.filter(r => !r.ok).length
      const modelosOk = testResultado.resultados.filter(r => r.ok).map(r => r.modelo)

      if (modelosOk.length > 0) {
        onTestComplete(provider.id, modelosOk)
      }

      setResultado({ buenos, malos, total: testResultado.resultados.length })

      if (malos > 0) {
        showSuccess(`${buenos} modelos buenos, ${malos} malos. Lista actualizada. (${malos} excluidos por test)`)
      } else {
        showSuccess(`${buenos} modelos buenos, ${malos} malos. Lista actualizada.`)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setCancelado(true)
        showSuccess('Test cancelado por el usuario')
      } else {
        showError(e as Error, 'No se pudo completar el test')
      }
    } finally {
      setEnCurso(false)
      testAbortRef.current = null
    }
  }

  const cancelarTest = () => {
    testAbortRef.current?.abort()
  }

  if (!open || !provider) return null

  return (
    <Modal open={open} onClose={cerrarTestModal} title={`Testear modelos — ${provider.nombre}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Se probarán <strong>{provider.modelos.length}</strong> modelos con 2 prompts (corto y largo).
          {!enCurso && !resultado && ' Presione "Iniciar test" para comenzar.'}
          {enCurso && ' El test está en curso…'}
          {resultado && (
            <span className={resultado.malos > 0 ? 'text-amber-600' : 'text-green-600'}>
              {' '}{resultado.buenos} buenos, {resultado.malos} malos de {resultado.total} probados.
            </span>
          )}
          {cancelado && ' Test cancelado por el usuario.'}
        </p>

        {enCurso && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            {Object.values(progreso).filter(v => v !== 'pendiente').length} de {provider.modelos.length} probados
          </div>
        )}

        <div className="rounded-lg border border-border overflow-hidden" style={{ maxHeight: '50vh' }}>
          <ScrollArea className="max-h-[calc(50vh-8px)]" hideScrollbarX>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-header text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Modelo</th>
                  <th className="px-3 py-2 text-center font-semibold w-24">Estado</th>
                </tr>
              </thead>
              <tbody>
                {provider.modelos.map((modelo) => {
                  const status = progreso[modelo]
                  return (
                    <tr key={modelo} className="border-b border-border/50 hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-800">{modelo}</td>
                      <td className="px-3 py-1.5 text-center">
                        {status === 'pendiente' && <span className="text-xs text-gray-400">—</span>}
                        {status === 'probando' && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                            <Loader2 className="h-3 w-3 animate-spin" /> Probando
                          </span>
                        )}
                        {status === 'ok' && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="h-3 w-3" /> OK
                          </span>
                        )}
                        {status === 'fallo' && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <XCircle className="h-3 w-3" /> Fallo
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {!enCurso && !resultado && (
            <Button size="sm" onClick={iniciarTest}>
              <Play className="h-3.5 w-3.5 mr-1" /> Iniciar test
            </Button>
          )}
          {enCurso && (
            <Button size="sm" variant="secondary" onClick={cancelarTest}>
              <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
          )}
          {(resultado || cancelado || (!enCurso && provider.modelos.length > 0)) && (
            <Button size="sm" variant="secondary" onClick={cerrarTestModal}>
              Cerrar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}