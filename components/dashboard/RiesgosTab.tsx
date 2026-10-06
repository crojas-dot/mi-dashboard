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
import { ChartEmpty, Panel, contarPor, opcionesBarras, opcionesDonut, opcionesLinea, seriesDelAnio, uiColors } from './chartKit'
import { useRiesgosAnalisis } from '@/lib/queries/useModulosAnalisis'
import styles from '@/app/dashboard.styles'
import { useDashboardNow } from './useDashboardNow'
import { useZonaHoraria } from '@/lib/queries/useZonaHoraria'
import { DEFAULT_TIME_ZONE } from '@/lib/timeZone'

const SERIEDAD_NIVEL: Record<string, number> = { Crítico: 4, Alto: 3, Medio: 2, Bajo: 1 }

export default function RiesgosTab() {
  const { data: filas, isPending, isFetching, error, refetch } = useRiesgosAnalisis()
  const c = uiColors()
  const ahora = useDashboardNow()
  const zonaQuery = useZonaHoraria()
  const zona = zonaQuery.data ?? DEFAULT_TIME_ZONE

  const colorNivel = useMemo(() => ({ Crítico: c.danger, Alto: c.warning, Medio: c.info, Bajo: c.secondary } as Record<string, string>), [c])

  const porNivel = useMemo(() => {
    const grupos = new Map<string, number>()
    for (const f of filas ?? []) {
      const clave = f.nivel?.trim() || 'Sin nivel'
      grupos.set(clave, (grupos.get(clave) ?? 0) + 1)
    }
    return [...grupos.entries()]
      .map(([etiqueta, total]) => ({ etiqueta, total }))
      .sort((a, b) => (SERIEDAD_NIVEL[b.etiqueta] ?? 0) - (SERIEDAD_NIVEL[a.etiqueta] ?? 0) || b.total - a.total)
  }, [filas])
  const nivelData = useMemo(() => ({
    labels: porNivel.map((n) => n.etiqueta),
    datasets: [{ label: 'Riesgos', data: porNivel.map((n) => n.total), backgroundColor: porNivel.map((n) => colorNivel[n.etiqueta] ?? c.muted), borderRadius: 3, maxBarThickness: 16 }],
  }), [porNivel, colorNivel, c])

  const porEstado = useMemo(() => contarPor(filas ?? [], (f) => f.estado ?? 'Sin estado')
    .sort((a, b) => SeriedadEstado(b.etiqueta) - SeriedadEstado(a.etiqueta)), [filas])
  const totalEstado = useMemo(() => (filas ?? []).length, [filas])
  const coloresEstados = useMemo(() => [c.info, c.primary, c.warning, c.success, c.secondary, c.danger], [c])
  const donutData = useMemo(() => ({
    labels: porEstado.map((e) => e.etiqueta),
    datasets: [{ data: porEstado.map((e) => e.total), backgroundColor: porEstado.map((e, i) => coloresEstados[i % coloresEstados.length]), borderWidth: 0 }],
  }), [porEstado, coloresEstados])
  const esDonut = porEstado.length > 0 && porEstado.length <= 6

  const porCategoria = useMemo(() => contarPor(filas ?? [], (f) => f.categoria ?? f.descripcion).slice(0, 8), [filas])
  const categoriaData = useMemo(() => ({
    labels: porCategoria.map((p) => p.etiqueta),
    datasets: [{ label: 'Riesgos', data: porCategoria.map((p) => p.total), backgroundColor: c.primary, borderRadius: 3, maxBarThickness: 16 }],
  }), [porCategoria, c])

  const identificados = useMemo(() => seriesDelAnio(filas ?? [], (f) => f.fecha_identificacion, ahora, zona), [filas, ahora, zona])
  const serieData = useMemo(() => ({
    labels: identificados.meses,
    datasets: [{ label: 'Identificados', data: identificados.valores, borderColor: c.danger, backgroundColor: c.danger, tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2 }],
  }), [identificados, c])
  const identificadosMes = identificados.valores.at(-1) ?? 0

  const prioritarios = useMemo(() => (filas ?? [])
    .filter((f) => f.estado !== 'Cerrado' && f.estado !== 'Mitigado')
    .map((f) => ({ ...f, severidad: (SERIEDAD_NIVEL[f.nivel ?? ''] ?? 0) }))
    .sort((a, b) => b.severidad - a.severidad || (b.impacto * Math.max(b.probabilidad, 1)) - (a.impacto * Math.max(a.probabilidad, 1)))
    .slice(0, 8), [filas])

  if (error) {
    return <ErrorState error={error} title="No se pudieron cargar los datos del módulo de riesgos" onRetry={() => void refetch()} retrying={isFetching} />
  }
  if (zonaQuery.error) return <ErrorState error={zonaQuery.error} title="No se pudo cargar la zona horaria" onRetry={() => void zonaQuery.refetch()} retrying={zonaQuery.isFetching} />
  if (isPending || !filas || zonaQuery.isPending) {
    return <div role="status" className={styles.empty}><Spinner color="primary" /></div>
  }

  return (
    <div role="tabpanel">
      <GridRow className="tw:gap-4 tw:mb-6">
        <GridCol xs={12} lg={8}>
          <Panel title={`Riesgos identificados por mes en ${identificados.anio}`}>
            {filas.length ? (
              <div className={styles.chartLarge}>
                <Chart
                  type="line"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={`Riesgos identificados por mes · ${identificadosMes} este mes`}
                  data={serieData}
                  options={opcionesLinea(c) as never}
                />
              </div>
            ) : (
              <ChartEmpty mensaje="No hay riesgos registrados." />
            )}
          </Panel>
        </GridCol>
        <GridCol xs={12} lg={4}>
          <Panel title="Estado de tratamiento">
            {porEstado.length === 0 ? (
              <ChartEmpty mensaje="No hay riesgos registrados." />
            ) : esDonut ? (
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
                  <div className={styles.donutTotal}><strong>{totalEstado}</strong><span>Riesgos</span></div>
                </div>
                <div className={styles.legend}>
                  {porEstado.map((e, i) => (
                    <span key={e.etiqueta}><i style={{ background: coloresEstados[i % coloresEstados.length] }} />{e.etiqueta} <strong>{e.total}</strong></span>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.chartMedium}>
                <Chart
                  type="bar"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={porEstado.map((e) => `${e.etiqueta}: ${e.total}`).join(', ')}
                  data={{ labels: porEstado.map((e) => e.etiqueta), datasets: [{ data: porEstado.map((e) => e.total), backgroundColor: porEstado.map((_, i) => coloresEstados[i % coloresEstados.length]), borderRadius: 3, maxBarThickness: 16 }] }}
                  options={opcionesBarras(c, { horizontal: true }) as never}
                />
              </div>
            )}
          </Panel>
        </GridCol>
      </GridRow>

      <GridRow className="tw:gap-4 tw:mb-6">
        <GridCol xs={12} lg={6}>
          <Panel title="Riesgos por nivel">
            {porNivel.length === 0 ? (
              <ChartEmpty mensaje="No hay riesgos registrados." />
            ) : (
              <div className={styles.chartMedium}>
                <Chart
                  type="bar"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={porNivel.map((n) => `${n.etiqueta}: ${n.total}`).join(', ')}
                  data={nivelData}
                  options={opcionesBarras(c, { horizontal: true }) as never}
                />
              </div>
            )}
          </Panel>
        </GridCol>
        <GridCol xs={12} lg={6}>
          <Panel title="Riesgos por proceso">
            {porCategoria.length === 0 ? (
              <ChartEmpty mensaje="No hay riesgos registrados." />
            ) : (
              <div className={styles.chartMedium}>
                <Chart
                  type="bar"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={porCategoria.map((p) => `${p.etiqueta}: ${p.total}`).join(', ')}
                  data={categoriaData}
                  options={opcionesBarras(c, { horizontal: true }) as never}
                />
              </div>
            )}
          </Panel>
        </GridCol>
      </GridRow>

      <Card className="tw:mb-6">
        <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
          <h2 className="tw:m-0 tw:text-xl">Riesgos prioritarios</h2>
          <Link href="/riesgos" className="tw:font-medium tw:no-underline" style={{ fontSize: 14 }}>Ver todos los riesgos</Link>
        </CardHeader>
        <CardContent className="tw:p-0">
          <DataTable hover responsive className="tw:mb-0 tw:align-middle">
            <TableHead>
              <tr>{['Folio', 'Riesgo', 'Nivel', 'P × I', 'Estado'].map((label) => <TableHeaderCell key={label} scope="col">{label}</TableHeaderCell>)}</tr>
            </TableHead>
            <tbody>
              {prioritarios.length === 0 ? (
                <tr><TableCell colSpan={5}><div className={styles.emptyTable}>No hay riesgos prioritarios pendientes.</div></TableCell></tr>
              ) : prioritarios.map((f) => (
                <tr key={f.id}>
                  <TableCell><Link href="/riesgos" className={styles.folio}>{f.folio ?? '—'}</Link></TableCell>
                  <TableCell>{f.descripcion ? `${f.descripcion.slice(0, 60)}${f.descripcion.length > 60 ? '…' : ''}` : '—'}{f.categoria ? <div className="tw:text-sm tw:text-muted">{f.categoria}</div> : null}</TableCell>
                  <TableCell><Badge variant={nivelVariant(f.nivel)}>{f.nivel ?? 'Sin nivel'}</Badge></TableCell>
                  <TableCell>{f.probabilidad} × {f.impacto}</TableCell>
                  <TableCell><Badge variant={estadoVariantRiesgo(f.estado)}>{f.estado ?? '—'}</Badge></TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  )
}

function nivelVariant(nivel?: string | null): string {
  switch (nivel) {
    case 'Crítico': return 'red'
    case 'Alto': return 'orange'
    case 'Medio': return 'amber'
    case 'Bajo': return 'gray'
    default: return 'gray'
  }
}

function estadoVariantRiesgo(estado?: string | null): string {
  switch (estado) {
    case 'Mitigado':
    case 'Cerrado':
    case 'Resuelto': return 'green'
    case 'En Proceso':
    case 'En tratamiento':
    case 'Mitigación': return 'amber'
    case 'Activo': return 'blue'
    default: return 'gray'
  }
}

function SeriedadEstado(estado: string): number {
  switch (estado) {
    case 'Activo':
    case 'Abierto': return 4
    case 'En Proceso':
    case 'En tratamiento':
    case 'Mitigación': return 3
    case 'En Validación': return 2
    default: return 0
  }
}
