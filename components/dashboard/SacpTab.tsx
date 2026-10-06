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
import Chart from './Chart'
import { ChartEmpty, Panel, PanelMetric, contarPor, opcionesBarras, opcionesDonut, opcionesLinea, seriesDelAnio, uiColors } from './chartKit'
import { useSacpAnalisis } from '@/lib/queries/useModulosAnalisis'
import { estadoSACPVariant, prioridadVariant } from '@/lib/constants/variants'
import styles from '@/app/dashboard.styles'
import { useDashboardNow } from './useDashboardNow'
import { useZonaHoraria } from '@/lib/queries/useZonaHoraria'
import { DEFAULT_TIME_ZONE, fechaCivilClave } from '@/lib/timeZone'
import { estadoPlazo, formatoFechaPlazo } from './plazos'

const ORDEN_SACP = ['Abierta', 'En Proceso', 'En Validación', 'Cerrada']
const COLOR_SACP: Record<string, string> = { Abierta: 'info', 'En Proceso': 'warning', 'En Validación': 'primary', Cerrada: 'success' }

export default function SacpTab() {
  const { data: filas, isPending, isFetching, error, refetch } = useSacpAnalisis()
  const ahora = useDashboardNow()
  const zonaQuery = useZonaHoraria()
  const zona = zonaQuery.data ?? DEFAULT_TIME_ZONE
  const c = uiColors()

  const colorEstado = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const e of ORDEN_SACP) mapa[e] = { info: c.info, warning: c.warning, primary: c.primary, success: c.success }[COLOR_SACP[e] as 'info' | 'warning' | 'primary' | 'success']
    mapa.Otros = c.muted
    return mapa
  }, [c])

  const porEstado = useMemo(() => {
    const grupos = new Map<string, number>()
    for (const f of filas ?? []) {
      const clave = f.estado?.trim() || 'Otros'
      grupos.set(clave, (grupos.get(clave) ?? 0) + 1)
    }
    return [...grupos.entries()]
      .map(([etiqueta, total]) => ({ etiqueta, total }))
      .sort((a, b) => ORDEN_SACP.indexOf(a.etiqueta) - ORDEN_SACP.indexOf(b.etiqueta))
  }, [filas])
  const totalEstado = useMemo(() => porEstado.reduce((sum, e) => sum + e.total, 0), [porEstado])
  const donutData = useMemo(() => ({
    labels: porEstado.map((e) => e.etiqueta),
    datasets: [{ data: porEstado.map((e) => e.total), backgroundColor: porEstado.map((e) => colorEstado[e.etiqueta] ?? c.muted), borderWidth: 0 }],
  }), [porEstado, colorEstado, c])

  const creadas = useMemo(() => seriesDelAnio(filas ?? [], (f) => f.fecha_apertura, ahora, zona), [filas, ahora, zona])
  const serieData = useMemo(() => ({
    labels: creadas.meses,
    datasets: [{ label: 'Creadas', data: creadas.valores, borderColor: c.primary, backgroundColor: c.primary, tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2 }],
  }), [creadas, c])
  const creadasMes = creadas.valores.at(-1) ?? 0

  const plazos = useMemo(() => {
    const b = { Vencidas: 0, 'Próximas a vencer': 0, 'A tiempo': 0, Cerradas: 0, 'Sin fecha': 0 }
    for (const f of filas ?? []) {
      if (f.estado === 'Cerrada') { b.Cerradas += 1; continue }
      if (!f.fecha_limite) { b['Sin fecha'] += 1; continue }
      const situacion = estadoPlazo(f.fecha_limite, ahora, zona)
      if (situacion === 'Sin fecha') { b['Sin fecha'] += 1; continue }
      if (situacion === 'Vencido') { b.Vencidas += 1; continue }
      const diaLimite = /^\d{4}-\d{2}-\d{2}$/.test(f.fecha_limite)
        ? f.fecha_limite : fechaCivilClave(f.fecha_limite, zona)
      const dias = (Date.parse(`${diaLimite}T00:00:00Z`) - Date.parse(`${fechaCivilClave(ahora, zona)}T00:00:00Z`)) / 86400000
      if (dias <= 7) b['Próximas a vencer'] += 1
      else b['A tiempo'] += 1
    }
    return b
  }, [filas, ahora, zona])
  const plazosData = useMemo(() => ({
    labels: ['Vencidas', 'Próximas a vencer', 'A tiempo', 'Cerradas', 'Sin fecha'],
    datasets: [{ data: [plazos.Vencidas, plazos['Próximas a vencer'], plazos['A tiempo'], plazos.Cerradas, plazos['Sin fecha']], backgroundColor: [c.danger, c.warning, c.info, c.success, c.secondary], borderRadius: 2, maxBarThickness: 18 }],
  }), [plazos, c])

  const porTipo = useMemo(() => contarPor(filas ?? [], (f) => f.tipo).slice(0, 8), [filas])
  const totalPlazos = plazos.Vencidas + plazos['Próximas a vencer'] + plazos['A tiempo'] + plazos.Cerradas + plazos['Sin fecha']
  const tipoData = useMemo(() => ({
    labels: porTipo.map((t) => t.etiqueta),
    datasets: [{ label: 'Acciones', data: porTipo.map((t) => t.total), backgroundColor: c.primary, borderRadius: 3, maxBarThickness: 16 }],
  }), [porTipo, c])

  const atencion = useMemo(() => (filas ?? [])
    .filter((f) => f.estado !== 'Cerrada' && f.estado !== 'En Validación')
    .map((f) => ({ ...f, _ts: f.fecha_limite ? new Date(f.fecha_limite).getTime() : Number.POSITIVE_INFINITY }))
    .sort((a, b) => a._ts - b._ts)
    .slice(0, 8), [filas])

  if (error) {
    return <ErrorState error={error} title="No se pudieron cargar los datos del módulo SACP" onRetry={() => void refetch()} retrying={isFetching} />
  }
  if (zonaQuery.error) return <ErrorState error={zonaQuery.error} title="No se pudo cargar la zona horaria" onRetry={() => void zonaQuery.refetch()} retrying={zonaQuery.isFetching} />
  if (isPending || !filas || zonaQuery.isPending) {
    return <div role="status" className={styles.empty}><Spinner color="primary" /></div>
  }

  return (
    <div role="tabpanel">
      <GridRow className="tw:gap-4 tw:mb-6">
        <GridCol xs={12} lg={8}>
          <Panel title={`SACP creadas por mes en ${creadas.anio}`} action={<PanelMetric color="primary" etiqueta="Creadas este mes" valor={creadasMes} />}>
            {filas.length ? (
              <div className={styles.chartLarge}>
                <Chart
                  type="line"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label="Acciones SACP creadas por mes"
                  data={serieData}
                  options={opcionesLinea(c) as never}
                />
              </div>
            ) : (
              <ChartEmpty mensaje="No hay acciones SACP registradas." />
            )}
          </Panel>
        </GridCol>
        <GridCol xs={12} lg={4}>
          <Panel title="SACP por estado">
            {porEstado.length === 0 ? (
              <ChartEmpty mensaje="No hay acciones SACP registradas." />
            ) : (
              <>
                <div className={styles.donut}>
                  <Chart
                    type="doughnut"
                    wrapper={false}
                    customTooltips={false}
                    role="img"
                    aria-label={porEstado.map((e) => `${e.etiqueta}: ${e.total}`).join(', ')}
                    data={donutData}
                    options={opcionesDonut() as never}
                  />
                  <div className={styles.donutTotal}><strong>{totalEstado}</strong><span>Acciones</span></div>
                </div>
                <div className={styles.legend}>
                  {porEstado.map((e) => (
                    <span key={e.etiqueta}><i style={{ background: colorEstado[e.etiqueta] ?? c.muted }} />{e.etiqueta} <strong>{e.total}</strong></span>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </GridCol>
      </GridRow>

      <GridRow className="tw:gap-4 tw:mb-6">
        <GridCol xs={12} lg={6}>
          <Panel title="Estado de los plazos" action={
            <div className="tw:flex tw:gap-2 tw:flex-wrap">
              <PanelMetric color="success" etiqueta="Cerradas" valor={plazos.Cerradas} />
              <PanelMetric color="warning" etiqueta="Próx. vencer" valor={plazos['Próximas a vencer']} />
              <PanelMetric color="danger" etiqueta="Vencidas" valor={plazos.Vencidas} />
            </div>
          }>
            <p className={styles.chartNote}>Cerrada indica el estado de la acción, no si terminó dentro del plazo.</p>
            {totalPlazos === 0 ? (
              <ChartEmpty mensaje="No hay acciones con fecha límite." />
            ) : (
              <div className={styles.chartMedium}>
                <Chart
                  type="bar"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={`Plazos · cerradas ${plazos.Cerradas}, a tiempo ${plazos['A tiempo']}, próximas a vencer ${plazos['Próximas a vencer']}, vencidas ${plazos.Vencidas}, sin fecha ${plazos['Sin fecha']}`}
                  data={plazosData}
                  options={opcionesBarras(c, { horizontal: true }) as never}
                />
              </div>
            )}
          </Panel>
        </GridCol>
        <GridCol xs={12} lg={6}>
          <Panel title="SACP por tipo">
            {porTipo.length === 0 ? (
              <ChartEmpty mensaje="No hay acciones SACP registradas." />
            ) : (
              <div className={styles.chartMedium}>
                <Chart
                  type="bar"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={porTipo.map((t) => `${t.etiqueta}: ${t.total}`).join(', ')}
                  data={tipoData}
                  options={opcionesBarras(c, { horizontal: true }) as never}
                />
              </div>
            )}
          </Panel>
        </GridCol>
      </GridRow>

      <Card className="tw:mb-6">
        <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
          <h2 className="tw:m-0 tw:text-xl">SACP que requieren atención</h2>
          <Link href="/sacp" className="tw:font-medium tw:no-underline" style={{ fontSize: 14 }}>Ver todas las acciones</Link>
        </CardHeader>
        <CardContent className="tw:p-0">
          <DataTable hover responsive className="tw:mb-0 tw:align-middle">
            <TableHead>
              <tr>{['Folio', 'Tipo', 'Estado', 'Prioridad', 'Vencimiento'].map((label) => <TableHeaderCell key={label} scope="col">{label}</TableHeaderCell>)}</tr>
            </TableHead>
            <tbody>
              {atencion.length === 0 ? (
                <tr><TableCell colSpan={5}><div className={styles.emptyTable}>No hay acciones pendientes de cierre.</div></TableCell></tr>
              ) : atencion.map((f) => (
                <tr key={f.id}>
                  <TableCell><Link href="/sacp" className={styles.folio}>{f.folio ?? '—'}</Link></TableCell>
                  <TableCell>{f.tipo}{f.descripcion ? <div className="tw:text-sm tw:text-muted">{f.descripcion.slice(0, 48)}{f.descripcion.length > 48 ? '…' : ''}</div> : null}</TableCell>
                  <TableCell><Badge variant={estadoSACPVariant[f.estado] ?? 'gray'}>{f.estado}</Badge></TableCell>
                  <TableCell>{f.prioridad ? <Badge variant={prioridadVariant[f.prioridad] ?? 'gray'}>{f.prioridad}</Badge> : '—'}</TableCell>
                  <TableCell className="tw:whitespace-nowrap">{formatoFechaPlazo(f.fecha_limite, zona)}</TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  )
}
