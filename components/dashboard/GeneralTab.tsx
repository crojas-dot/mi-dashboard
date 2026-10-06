'use client'
import { Spinner } from '@/components/ui/tailwind/Spinner'
import { GridRow } from '@/components/ui/tailwind/Grid'
import { GridCol } from '@/components/ui/tailwind/Grid'
import { Card } from '@/components/ui/tailwind/Card'
import { CardHeader } from '@/components/ui/tailwind/Card'
import { CardContent } from '@/components/ui/tailwind/Card'
import { CardFooter } from '@/components/ui/tailwind/Card'
import { DataTable } from '@/components/ui/tailwind/DataTable'
import { TableHead } from '@/components/ui/tailwind/Table'
import { TableHeaderCell } from '@/components/ui/tailwind/Table'
import { TableCell } from '@/components/ui/tailwind/Table'

import { useMemo } from 'react'
import Link from 'next/link'

import ErrorState from '@/components/ui/tailwind/ErrorState'
import Badge from '@/components/ui/tailwind/Badge'
import { prioridadVariant } from '@/lib/constants/variants'
import { DASHBOARD_MODULES } from '@/lib/constants/dashboardModules'
import { tienePermiso } from '@/lib/permisos'
import { useAuthStore } from '@/lib/store/auth-store'
import { useGeneralTotales } from '@/lib/queries/useGeneralTotales'
import type { DashboardData } from '@/lib/queries/useDashboard'
import { useZonaHoraria } from '@/lib/queries/useZonaHoraria'
import { useDashboardNow } from './useDashboardNow'
import BreakdownChart from './BreakdownChart'
import { PanelMetric, uiColors } from './chartKit'
import { contarPlazos, formatoFechaPlazo } from './plazos'
import styles from '@/app/dashboard.styles'

interface GeneralTabProps {
  data?: DashboardData
  isPending: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
}

const estadoBadge: Record<string, string> = {
  Abierta: 'red', Alta: 'red', 'En Proceso': 'amber', Planificada: 'blue',
  Abierto: 'red', Pendiente: 'amber', Cerrada: 'green', Cerrado: 'green',
  Publicado: 'green', Borrador: 'gray', Activo: 'green', Inactivo: 'gray',
}

export default function GeneralTab({ data, isPending, isFetching, error, refetch }: GeneralTabProps) {
  const user = useAuthStore((state) => state.user)
  const permisos = useAuthStore((state) => state.permisos)
  // La misma autorización que usa Sidebar evita consultar módulos ocultos por
  // rol o por la vista simulada. La base aplica RLS a cada COUNT igualmente.
  const modulos = useMemo(() => DASHBOARD_MODULES.filter((modulo) =>
    tienePermiso(permisos, modulo.id, false, user?.rol)), [permisos, user?.rol])
  const totales = useGeneralTotales(modulos)
  const zonaQuery = useZonaHoraria()
  const ahora = useDashboardNow()
  const colores = uiColors()

  const tareas = useMemo<Array<DashboardData['tareas'][number] & { prioridad?: string | null }>>(() => (data?.tareas ?? []).filter((tarea) =>
    modulos.some((modulo) => modulo.nombre === tarea.entidad)), [data?.tareas, modulos])
  const vencimientos = useMemo(() => contarPlazos(tareas, (tarea) => tarea.vence, ahora, zonaQuery.data),
    [tareas, ahora, zonaQuery.data])
  const cuenta = new Map(totales.data?.map((item) => [item.id, item.total]) ?? [])
  const filasModulos = modulos.map((modulo, indice) => ({
    ...modulo, indice, total: cuenta.get(modulo.id) ?? 0,
  })).sort((a, b) => b.total - a.total || a.indice - b.indice)
  const totalRegistros = filasModulos.reduce((suma, modulo) => suma + modulo.total, 0)
  const conRegistros = filasModulos.filter((modulo) => modulo.total > 0).length

  if (error) return <ErrorState error={error} title="No se pudo cargar el panel general" onRetry={() => void refetch()} retrying={isFetching} />
  if (zonaQuery.error) return <ErrorState error={zonaQuery.error} title="No se pudo cargar la zona horaria" onRetry={() => void zonaQuery.refetch()} retrying={zonaQuery.isFetching} />
  if (isPending || !data || zonaQuery.isPending) return <div role="status" className={styles.empty}><Spinner color="primary" /></div>

  return <div role="tabpanel">
    <Card className="tw:mb-6">
      <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-4">
        <h2 className="tw:m-0 tw:text-xl">Registros por módulo</h2>
        {!totales.isPending && !totales.error && <div className="tw:flex tw:gap-4 tw:flex-wrap">
          <PanelMetric color="primary" etiqueta="Registros visibles" valor={totalRegistros.toLocaleString('es-CR')} />
          <PanelMetric color="success" etiqueta="Módulos con registros" valor={`${conRegistros} de ${modulos.length}`} />
        </div>}
      </CardHeader>
      <CardContent>
        <p className={styles.chartNote}>Cada barra muestra el total de registros del módulo, incluidos los cerrados. Los colores identifican cada proceso; la altura de la barra no representa cumplimiento.</p>
        {modulos.length === 0 ? <p className="tw:text-muted tw:mb-0">No hay módulos de gestión habilitados en esta vista.</p>
          : totales.error ? <ErrorState error={totales.error} title="No se pudieron cargar los totales por módulo" onRetry={() => void totales.refetch()} retrying={totales.isFetching} />
            : totales.isPending ? <div role="status" className={styles.empty}><Spinner color="primary" /></div>
              : <BreakdownChart filas={filasModulos.map((modulo) => ({ etiqueta: modulo.nombre, total: modulo.total, color: modulo.color }))} nombre="Registros" />}
      </CardContent>
      {!totales.isPending && !totales.error && modulos.length > 0 && <CardFooter className="tw:block">
        <nav className={styles.moduleLinks} aria-label="Abrir módulos del resumen">
          {filasModulos.map((modulo) => <Link key={modulo.id} href={modulo.ruta} className={styles.moduleLink}>
            <span className={styles.moduleSwatch} style={{ backgroundColor: colores[modulo.color] }} aria-hidden="true" />
            <span>{modulo.nombre}</span><strong className={styles.moduleValue}>{modulo.total.toLocaleString('es-CR')}</strong>
          </Link>)}
        </nav>
      </CardFooter>}
    </Card>

    <GridRow className="tw:gap-4">
      <GridCol xs={12} lg={5}>
        <Card className="tw:h-full">
          <CardHeader><h2 className="tw:m-0 tw:text-xl">Plazos de expedientes destacados</h2></CardHeader>
          <CardContent>
            <p className={styles.chartNote}>Se refiere solo a los {tareas.length} expedientes de Quejas y SACP mostrados al lado; no es el total de vencimientos del sistema.</p>
            <BreakdownChart filas={vencimientos} nombre="Expedientes" />
          </CardContent>
        </Card>
      </GridCol>
      <GridCol xs={12} lg={7}>
        <Card className="tw:h-full">
          <CardHeader><h2 className="tw:m-0 tw:text-xl">Expedientes que requieren atención</h2></CardHeader>
          <CardContent className="tw:p-0">
            <DataTable hover responsive className="tw:mb-0 tw:align-middle">
              <TableHead><tr>
                {['Expediente', 'Módulo', 'Estado', 'Vencimiento', 'Prioridad'].map((label) =>
                  <TableHeaderCell key={label} scope="col">{label}</TableHeaderCell>)}
              </tr></TableHead>
              <tbody>
                {tareas.length === 0 ? <tr><TableCell colSpan={5}>
                  <div className={styles.emptyTable}>No hay expedientes pendientes.</div>
                </TableCell></tr> : tareas.map((tarea) => <tr key={`${tarea.entidad}-${tarea.id}`}>
                  <TableCell><strong className="tw:font-medium">{tarea.titulo}</strong></TableCell>
                  <TableCell>{tarea.entidad}</TableCell>
                  <TableCell><Badge variant={estadoBadge[tarea.estado] ?? 'gray'}>{tarea.estado}</Badge></TableCell>
                  <TableCell className="tw:whitespace-nowrap">{formatoFechaPlazo(tarea.vence, zonaQuery.data)}</TableCell>
                  <TableCell>{tarea.prioridad ? <Badge variant={prioridadVariant[tarea.prioridad] ?? 'gray'}>{tarea.prioridad}</Badge> : '—'}</TableCell>
                </tr>)}
              </tbody>
            </DataTable>
          </CardContent>
        </Card>
      </GridCol>
    </GridRow>
  </div>
}
