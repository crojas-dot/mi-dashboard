import { CheckCircle, XCircle, Play, ShieldAlert } from 'lucide-react'
import type { ModelTestState } from './types'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

interface Props { testModal: ModelTestState; cerrarTestModal: () => void; iniciarTest: () => Promise<void>; cancelarTest: () => void }

/** Progreso acotado de una operación real; sin requests ni temporizadores por fila. */
export default function ModelTestModal({ testModal, cerrarTestModal, iniciarTest, cancelarTest }: Props) {
  return (<Modal
        open={testModal.abierto}
        onClose={cerrarTestModal}
        title={`Testear modelos — ${testModal.providerNombre}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Se probarán hasta <strong>{Math.min(20, testModal.modelos.length)}</strong> modelos con un prompt corto.
            {!testModal.enCurso && !testModal.resultado && ' Presione "Iniciar test" para comenzar.'}
            {testModal.enCurso && ' El test está en curso…'}
            {testModal.resultado && (
              <span className={testModal.resultado.malos > 0 ? 'text-amber-600' : 'text-green-600'}>
                {' '}{testModal.resultado.buenos} buenos, {testModal.resultado.malos} malos de {testModal.resultado.total} probados.
              </span>
            )}
            {testModal.cancelado && ' Test cancelado por el usuario.'}
          </p>

          {testModal.enCurso && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Spinner size="sm" className="text-qms-primary" />
              {Object.values(testModal.progreso).filter(v => v !== 'pendiente').length} de {testModal.modelos.length} probados
            </div>
          )}

          <div className="rounded-lg border border-qms-border overflow-hidden max-h-[50vh]">
            <div className="overflow-y-auto monday-scroll max-h-[calc(50vh-8px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-qms-table-head">
                    <th className="px-3 py-2 text-left font-semibold text-qms-dark">Modelo</th>
                    <th className="px-3 py-2 text-center font-semibold text-qms-dark w-24">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {testModal.modelos.map((modelo) => {
                    const status = testModal.progreso[modelo]
                    return (
                      <tr key={modelo} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono text-xs text-gray-800">{modelo}</td>
                        <td className="px-3 py-1.5 text-center">
                          {status === 'pendiente' && <span className="text-xs text-gray-400">—</span>}
                          {status === 'probando' && (
                            <span className="inline-flex items-center gap-1 text-xs text-qms-primary">
                              <Spinner size="sm" /> Probando
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
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            {!testModal.enCurso && !testModal.resultado && (
              <Button size="sm" onClick={iniciarTest}>
                <Play className="h-3.5 w-3.5 mr-1" /> Iniciar test
              </Button>
            )}
            {testModal.enCurso && (
              <Button size="sm" variant="secondary" onClick={cancelarTest}>
                <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
            )}
            {(testModal.resultado || testModal.cancelado || (!testModal.enCurso && testModal.modelos.length > 0)) && (
              <Button size="sm" variant="secondary" onClick={cerrarTestModal}>
                Cerrar
              </Button>
            )}
          </div>
        </div>
      </Modal>)
}
