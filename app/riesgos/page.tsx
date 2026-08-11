'use client'

import { useMemo, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useRiesgos, riesgosKey, type Riesgo } from '@/lib/queries/useRiesgos'
import PageHeader from '@/components/ui/PageHeader'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'

import Button from '@/components/ui/Button'
import NuevoRiesgoModal from './components/NuevoRiesgoModal'

const nivelColor: Record<string, string> = { Bajo: 'green', Medio: 'amber', Alto: 'red', Critico: 'red' }

export default function RiesgosPage() {
  const { data: riesgos = [], isLoading: loading } = useRiesgos()
  const queryClient = useQueryClient()
  const invalidateRiesgos = () => queryClient.invalidateQueries({ queryKey: riesgosKey })
  const [nuevoOpen, setNuevoOpen] = useState(false)

  const calcularNivel = (p: number, i: number): string => {
    const m = p * i
    if (m <= 2) return 'Bajo'
    if (m <= 4) return 'Medio'
    if (m <= 6) return 'Alto'
    return 'Critico'
  }

  const matriz = useMemo(() => {
    const grid: { p: number; i: number; items: Riesgo[] }[] = []
    for (let p = 1; p <= 3; p++)
      for (let i = 1; i <= 3; i++)
        grid.push({ p, i, items: riesgos.filter((r) => r.probabilidad === p && r.impacto === i) })
    return grid
  }, [riesgos])

  const colorCelda = (p: number, i: number) => {
    const m = p * i
    if (m <= 2) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    if (m <= 4) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Riesgos" description="Gestión de riesgos del SGC">
        <Button onClick={() => setNuevoOpen(true)}><Plus className="h-4 w-4" /> Nuevo Riesgo</Button>
      </PageHeader>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Matriz de Riesgos 3x3</h3>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-medium">
          <div className="text-gray-500">Prob \ Imp</div>
          {[1, 2, 3].map((i) => <div key={i} className="text-gray-500">Impacto {i}</div>)}
          {[1, 2, 3].map((p) => (
            <div key={p} className="contents">
              <div className="text-gray-500">Prob. {p}</div>
              {[1, 2, 3].map((i) => {
                const cell = matriz.find((m) => m.p === p && m.i === i)
                return (
                  <div key={`${p}-${i}`} className={`flex flex-col items-center justify-center rounded-lg p-3 ${colorCelda(p, i)}`}>
                    <span className="text-lg font-bold">{cell?.items.length || 0}</span>
                    <span className="text-[10px]">riesgos</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: '300px' }}><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Folio</TableHeaderCell>
            <TableHeaderCell>Probabilidad</TableHeaderCell>
            <TableHeaderCell>Impacto</TableHeaderCell>
            <TableHeaderCell>Nivel</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {riesgos.length === 0 ? <EmptyState message="No hay riesgos registrados" /> : (
            riesgos.map((r) => (
              <TableRow key={r.id}>
                <TableCell><span className="font-mono text-xs">{r.folio || '-'}</span></TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{r.probabilidad}</TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{r.impacto}</TableCell>
                <TableCell><Badge variant={nivelColor[r.nivel || ''] || 'gray'}>{r.nivel || calcularNivel(r.probabilidad, r.impacto)}</Badge></TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{r.estado}</TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
      )}

      <NuevoRiesgoModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={() => { invalidateRiesgos() }} />
    </div>
  )
}
