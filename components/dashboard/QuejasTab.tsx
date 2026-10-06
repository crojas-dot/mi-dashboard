'use client'
import { Spinner } from '@/components/ui/tailwind/Spinner'
import { GridRow } from '@/components/ui/tailwind/Grid'
import { GridCol } from '@/components/ui/tailwind/Grid'
import { Card } from '@/components/ui/tailwind/Card'
import { CardHeader } from '@/components/ui/tailwind/Card'
import { CardContent } from '@/components/ui/tailwind/Card'
import { DataTable } from '@/components/ui/tailwind/DataTable'
import { TableHead } from '@/components/ui/tailwind/Table'
import { TableHeaderCell } from '@/components/ui/tailwind/Table'
import { TableCell } from '@/components/ui/tailwind/Table'

import { useMemo } from 'react'
import Link from 'next/link'

import ErrorState from '@/components/ui/tailwind/ErrorState'
import Badge from '@/components/ui/tailwind/Badge'
import QuejasTrend from './QuejasTrend'
import BreakdownChart from './BreakdownChart'
import Chart from './Chart'
import { contarPlazos, estadoPlazo, formatoFechaPlazo } from './plazos'
import { PanelMetric, opcionesDonut, uiColors, type ColorSemantico } from './chartKit'
import { useQuejasEstadisticas, quejasEstadisticasKey } from '@/lib/queries/useQuejas'
import { useQuejasAnalisis, quejasAnalisisKey } from '@/lib/queries/useQuejasAnalisis'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { queryKeys } from '@/lib/queries/queryKeys'
import { estadoVariant } from '@/lib/constants/variants'
import styles from '@/app/dashboard.styles'
import { useDashboardNow } from './useDashboardNow'
import { useZonaHoraria } from '@/lib/queries/useZonaHoraria'
import { DEFAULT_TIME_ZONE, partesEnZona } from '@/lib/timeZone'

const COLORES_ESTADO: Record<string, ColorSemantico> = {
  Recibido: 'info', 'En Investigación': 'primary',
  'Pendiente de Revisión GC': 'warning', Resuelto: 'secondary',
  Finalizado: 'success', Cerrada: 'success', 'No Procede': 'danger',
}

export default function QuejasTab() {
  const estadisticas = useQuejasEstadisticas()
  const ahora = useDashboardNow()
  const c = uiColors()
  const zonaQuery = useZonaHoraria()
  const zona = zonaQuery.data
  const { data: analisis, isPending, isFetching, error, refetch } = useQuejasAnalisis(zona, partesEnZona(ahora, zona ?? DEFAULT_TIME_ZONE).anio)

  useRealtimeSubscription({
    table: 'quejas',
    invalidateKeys: [quejasEstadisticasKey, quejasAnalisisKey, [...queryKeys.dashboard]],
  })

  const plazos = useMemo(() => contarPlazos(analisis?.activas ?? [], (fila) => fila.fecha_sla, ahora, zona), [analisis?.activas, ahora, zona])

  const recibidasMes = analisis?.series.at(-1)?.recibidas
  const resueltasMes = analisis?.series.at(-1)?.resueltas

  // Conservar los estados reales evita confundir una resolución con el cierre definitivo.
  const situacion = analisis?.porEstado ?? []
  const totalSituacion = situacion.reduce((suma, estado) => suma + estado.total, 0)
  const datosEstado = {
    labels: situacion.map((estado) => estado.etiqueta),
    datasets: [{ data: situacion.map((estado) => estado.total),
      backgroundColor: situacion.map((estado) => c[COLORES_ESTADO[estado.etiqueta] ?? 'primary']), borderWidth: 0 }],
  }

  if (estadisticas.error) {
    return <ErrorState error={estadisticas.error} title="No se pudieron cargar los indicadores de quejas" onRetry={() => void estadisticas.refetch()} retrying={estadisticas.isFetching} />
  }
  if (zonaQuery.error) {
    return <ErrorState error={zonaQuery.error} title="No se pudo cargar la zona horaria" onRetry={() => void zonaQuery.refetch()} retrying={zonaQuery.isFetching} />
  }
  if (error) {
    return <ErrorState error={error} title="No se pudieron cargar los datos del módulo de quejas" onRetry={() => void refetch()} retrying={isFetching} />
  }
  if (!estadisticas.data || (isPending && !analisis)) {
    return <div role="status" className={styles.empty}><Spinner color="primary" /></div>
  }

  const d = estadisticas.data
  const noProceden = Math.max(0, d.totalConDecision - d.procedentes)
  const atencion = analisis?.atencion ?? []

  return (
    <div role="tabpanel">
      <p className={styles.chartNote}>Quejas recibidas en {analisis?.anio}, según la zona horaria configurada. Los cierres también incluyen quejas iniciadas en años anteriores.</p>
      <GridRow className="tw:gap-4 tw:mb-6">
        <GridCol xs={12} lg={8}>
          <Card className="tw:h-full">
            <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
              <h2 className="tw:m-0 tw:text-xl">Recibidas y cierres en {analisis?.anio}</h2>
              <div className="tw:flex tw:gap-2 tw:flex-wrap">
                <PanelMetric color="info" etiqueta="Recibidas este mes" valor={recibidasMes ?? d.mesActual} />
                <PanelMetric color="success" etiqueta="Cierres este mes" valor={resueltasMes ?? 0} />
              </div>
            </CardHeader>
            <CardContent>
              <QuejasTrend series={analisis?.series ?? []} anio={analisis?.anio ?? partesEnZona(ahora, zona ?? DEFAULT_TIME_ZONE).anio} />
            </CardContent>
          </Card>
        </GridCol>
        <GridCol xs={12} lg={4}>
          <Card className="tw:h-full">
            <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
              <h2 className="tw:m-0 tw:text-xl">Quejas por estado</h2>
            </CardHeader>
            <CardContent>
              {situacion.length ? <>
                <div className={styles.donut}>
                  <Chart type="doughnut" wrapper={false} customTooltips={false} role="img"
                    aria-label={situacion.map((estado) => `${estado.etiqueta}: ${estado.total}`).join(', ')}
                    data={datosEstado} options={opcionesDonut() as never} />
                  <div className={styles.donutTotal}><strong>{totalSituacion}</strong><span>Este año</span></div>
                </div>
                <div className={styles.legend}>
                  {situacion.map((estado) => <span key={estado.etiqueta}>
                    <i style={{ background: c[COLORES_ESTADO[estado.etiqueta] ?? 'primary'] }} />
                    {estado.etiqueta} <strong>{estado.total}</strong>
                  </span>)}
                </div>
              </> : <p className="tw:text-muted tw:mb-0">Sin quejas recibidas este año.</p>}
              <p className="tw:text-sm tw:text-muted tw:mt-4 tw:mb-0">Total histórico, todos los años: <strong>{d.total.toLocaleString('es-CR')}</strong> quejas. Procedencia entre decisiones: <strong>{d.pctProcedencia}%</strong> ({d.totalConDecision} con decisión; {noProceden} no proceden)</p>
            </CardContent>
          </Card>
        </GridCol>
      </GridRow>

      <GridRow className="tw:gap-4 tw:mb-6">
        <GridCol xs={12} lg={6}>
          <Card className="tw:h-full">
            <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
              <h2 className="tw:m-0 tw:text-xl">Plazos de quejas activas de este año</h2>
            </CardHeader>
            <CardContent>
              <p className={styles.chartNote}>Compara la fecha límite registrada con hoy. No representa un porcentaje de cumplimiento.</p>
              <BreakdownChart filas={plazos} nombre="Quejas" />
            </CardContent>
          </Card>
        </GridCol>
        <GridCol xs={12} lg={6}>
          <Card className="tw:h-full">
            <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
              <h2 className="tw:m-0 tw:text-xl">Casos por tipo</h2>
            </CardHeader>
            <CardContent>
              <p className={styles.chartNote}>Casos recibidos según su tipo. Los tipos adicionales se agrupan en Otras.</p>
              <BreakdownChart filas={analisis?.porCategoria ?? []} nombre="Quejas" />
            </CardContent>
          </Card>
        </GridCol>
      </GridRow>

      <Card>
        <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
          <h2 className="tw:m-0 tw:text-xl">Quejas que requieren atención</h2>
          <Link href="/quejas" className="tw:font-medium tw:no-underline" style={{ fontSize: 14 }}>Ver todas las quejas</Link>
        </CardHeader>
        <CardContent className="tw:p-0">
          <DataTable hover responsive className="tw:mb-0 tw:align-middle">
            <TableHead>
              <tr>{['Folio', 'Cliente', 'Estado', 'Plazo registrado', 'Vencimiento'].map((label) => <TableHeaderCell key={label} scope="col">{label}</TableHeaderCell>)}</tr>
            </TableHead>
            <tbody>
              {atencion.length === 0 ? (
                <tr><TableCell colSpan={5}><div className={styles.emptyTable}>No hay quejas de este año pendientes de atención.</div></TableCell></tr>
              ) : atencion.map((q) => {
                const plazo = estadoPlazo(q.fecha_sla, ahora, zona)
                const color = plazo === 'Vencido' ? 'red' : plazo === 'Vence hoy' ? 'amber' : 'gray'
                return (
                  <tr key={q.id}>
                    <TableCell><Link href="/quejas" className={styles.folio}>{q.folio}</Link></TableCell>
                    <TableCell>{q.cliente_nombre || '—'}</TableCell>
                    <TableCell><Badge variant={estadoVariant[q.estado] || 'gray'}>{q.estado}</Badge></TableCell>
                    <TableCell><Badge variant={color}>{plazo}</Badge></TableCell>
                    <TableCell className="tw:whitespace-nowrap">{formatoFechaPlazo(q.fecha_sla, zona)}</TableCell>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  )
}
