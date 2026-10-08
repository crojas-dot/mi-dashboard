'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useQueryClient } from '@tanstack/react-query'
import { useRiesgos, riesgosKey, useMatrizRiesgos } from '@/lib/queries/useRiesgos'
import Pagination from '@/components/ui/Pagination'
import PageHeader from '@/components/ui/PageHeader'
import { Table, TableHead, TableHeaderCell, TableRow, TableCell } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { nivelRiesgoVariant } from '@/lib/constants/estados'
import { calcularNivelRiesgo } from '@/lib/utils/riesgos'
import EmptyState from '@/components/ui/EmptyState'

import Button from '@/components/ui/Button'
import NuevoRiesgoModal from './components/NuevoRiesgoModal'

const matrizCellClass: Record<string, string> = {
  Bajo: 'bg-soft-green-bg text-soft-green-text',
  Medio: 'bg-soft-amber-bg text-soft-amber-text',
  Alto: 'bg-soft-red-bg text-soft-red-text',
  Critico: 'bg-soft-red-bg text-soft-red-text',
}

export default function RiesgosPage() {
  const [page, setPage] = useState(0)
  const { data: pagina, isLoading: loading, isFetching, error, refetch } = useRiesgos(page)
  const riesgos = pagina?.data ?? []
  const queryClient = useQueryClient()
  const invalidateRiesgos = () => queryClient.invalidateQueries({ queryKey: riesgosKey })
  const [nuevoOpen, setNuevoOpen] = useState(false)


  const matrizQuery = useMatrizRiesgos()
  const matriz = matrizQuery.data ?? []

  // La matriz conserva su leyenda de tres niveles; el registro conserva cuatro.
  const getCellLevel = (p: number, i: number): string => {
    const nivel = calcularNivelRiesgo(p, i)
    return nivel === 'Critico' ? 'Alto' : nivel
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Riesgos" description="Gestión de riesgos del SGC">
        <Button onClick={() => setNuevoOpen(true)}><Plus className="h-4 w-4" /> Nuevo Riesgo</Button>
      </PageHeader>

      <div className="rounded-card border border-qms-border bg-qms-surface p-4">
        <h3 className="mb-4 text-sm font-semibold text-qms-dark">Matriz de Riesgos 3x3</h3>
        {matrizQuery.error && <p role="alert">No se pudo cargar la matriz. <button onClick={() => void matrizQuery.refetch()}>Reintentar</button></p>}
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-medium">
          <div className="text-gray-500">Prob \ Imp</div>
          {[1, 2, 3].map((i) => <div key={i} className="text-gray-500">Impacto {i}</div>)}
          {[1, 2, 3].map((p) => (
            <div key={p} className="contents">
              <div className="text-gray-500">Prob. {p}</div>
              {[1, 2, 3].map((i) => {
                const cell = matriz.find((m) => m.p === p && m.i === i)
                const level = getCellLevel(p, i)
                return (
                  <div key={`${p}-${i}`} className={`flex flex-col items-center justify-center rounded p-3 ${matrizCellClass[level]}`}>
                    <span className="text-lg font-bold">{matrizQuery.isPending || matrizQuery.error ? '—' : cell?.count ?? 0}</span>
                    <span className="text-[10px]">riesgos</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {error ? <p role="alert">No se pudo cargar el listado. <button className="underline" onClick={() => void refetch()}>Reintentar</button></p> : loading ? (
        <LoadingSkeleton label="Cargando riesgos…" />
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
                <TableCell><Badge variant={nivelRiesgoVariant[r.nivel || ''] || 'gray'}>{r.nivel || calcularNivelRiesgo(r.probabilidad, r.impacto)}</Badge></TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{r.estado}</TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
      )}
      <Pagination page={page} count={pagina?.count ?? 0} busy={isFetching} onChange={setPage} />

      <NuevoRiesgoModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={() => { invalidateRiesgos() }} />
    </div>
  )
}
