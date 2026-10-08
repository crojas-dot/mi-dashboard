'use client'

import { ChevronLeft, Printer, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import OperationLoading from '@/components/ui/OperationLoading'
import Badge from '@/components/ui/Badge'
import { MODULOS_INFORME as modulos, columnasPorModulo, campoDistribucion, campoVencido } from './configuracion'
import { cellValue, contarEstados, contarDistribucion, filtrarVencidos } from './formato'
import type { FilaInforme, IncluirInforme } from './tipos'

interface Props {
  modulo: string
  incluir: IncluirInforme
  fechaDesde: string
  fechaHasta: string
  resultados: FilaInforme[]
  loading: boolean
  setPaso: (paso: number) => void
  onClose: () => void
}

/** Misma vista y clases de impresión; React escapa los valores de las filas. */
export default function VistaPreviaInforme({ modulo, incluir, fechaDesde, fechaHasta, resultados, loading, setPaso, onClose }: Props) {
  return (
<div>
      {loading ? (
        <OperationLoading label="Generando informe…" />
      ) : (
        <div className="space-y-5">
          <div className="text-center pb-3 border-b border-gray-200">
            <h2 className="m-0 text-xl font-bold text-qms-dark">Informe de {modulos.find(m => m.value === modulo)?.label}</h2>
            <p className="m-0 mt-1 text-sm text-qms-muted">Ente Costarricense de Acreditación</p>
            <p className="m-0 text-xs text-gray-400">
              Generado: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {fechaDesde && ` · Período: ${new Date(fechaDesde).toLocaleDateString('es-ES')} - ${new Date(fechaHasta).toLocaleDateString('es-ES')}`}
            </p>
          </div>

          {incluir.resumen && resultados.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-qms-dark">Resumen por Estado</h3>
              <div className="flex gap-3 flex-wrap">
                <div className="min-w-20 rounded-card border border-qms-border bg-qms-surface px-4 py-2 text-center">
                  <p className="m-0 text-2xl font-bold text-qms-primary">{resultados.length}</p>
                  <p className="m-0 text-xs text-qms-muted">Total</p>
                </div>
                {Object.entries(
                  contarEstados(resultados)
                ).map(([estado, count]) => (
                  <div key={estado} className="rounded-card border border-qms-border bg-qms-surface px-4 py-2 text-center min-w-[80px]">
                    <p className="text-2xl font-bold m-0 text-qms-dark">{count}</p>
                    <p className="text-xs m-0 text-qms-muted">{estado}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {incluir.distribucion && resultados.length > 0 && campoDistribucion[modulo] && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-qms-dark">
                Distribución por {modulo === 'quejas' ? 'Categoría' : 'Tipo'}
              </h3>
              <div className="rounded-lg border border-qms-border bg-white">
                <table className="w-full select-text text-sm">
                  <thead>
                    <tr className="bg-qms-table-head">
                      <th className="px-3 py-2 text-left font-semibold text-qms-dark">
                        {modulo === 'quejas' ? 'Categoría' : 'Tipo'}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-qms-dark">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      contarDistribucion(resultados, campoDistribucion[modulo])
                    ).map(([cat, count]) => (
                      <tr key={cat} className="border-b border-gray-200">
                        <td className="px-3 py-1.5">{cat}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {incluir.tabla && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-qms-dark">Registros</h3>
              <div className="rounded-lg border border-qms-border bg-white">
                <table className="w-full select-text text-sm">
                  <thead>
                    <tr className="bg-qms-table-head">
                      {columnasPorModulo[modulo]?.map((col) => (
                        <th key={col.key} className="px-3 py-2 text-left font-semibold text-qms-dark whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.length === 0 ? (
                      <tr><td colSpan={columnasPorModulo[modulo]?.length || 1} className="px-3 py-8 text-center text-gray-500">Sin registros</td></tr>
                    ) : (
                      resultados.map((row: FilaInforme) => (
                        <tr key={row.id} className="border-b border-gray-200">
                          {columnasPorModulo[modulo]?.map((col) => (
                            <td key={col.key} className="px-3 py-1.5 align-middle">
                              {col.key === 'prioridad' || col.key === 'estado' ? (
                                <Badge variant="gray">{cellValue(row, col.key)}</Badge>
                              ) : (
                                <span>{cellValue(row, col.key)}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {incluir.vencidos && resultados.length > 0 && campoVencido[modulo] && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-qms-danger">Registros Vencidos / Por Vencer</h3>
              <div className="rounded-lg border bg-white border-qms-danger">
                <table className="w-full select-text text-sm">
                  <thead>
                    <tr className="bg-qms-table-head">
                      {columnasPorModulo[modulo]?.map((col) => (
                        <th key={col.key} className="px-3 py-2 text-left font-semibold text-qms-dark whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const vencidos = filtrarVencidos(resultados, campoVencido[modulo])
                      return vencidos.length === 0 ? (
                        <tr><td colSpan={columnasPorModulo[modulo]?.length || 1} className="px-3 py-8 text-center text-gray-500">Sin registros vencidos</td></tr>
                      ) : (
                        vencidos.map((row: FilaInforme) => (
                          <tr key={row.id} className="border-b border-gray-200 bg-soft-red-bg">
                            {columnasPorModulo[modulo]?.map((col) => (
                              <td key={col.key} className="px-3 py-1.5 align-middle text-qms-danger">
                                {cellValue(row, col.key)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-200 no-print">
            <Button variant="secondary" onClick={() => setPaso(2)}><ChevronLeft className="h-4 w-4 inline" /> Atrás</Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4 inline" /> Imprimir</Button>
              <Button variant="secondary" onClick={onClose}><X className="h-4 w-4 inline" /> Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
