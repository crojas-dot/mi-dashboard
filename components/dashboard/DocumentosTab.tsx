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
import { useDocumentosAnalisis, useVersionesAnalisis } from '@/lib/queries/useModulosAnalisis'
import { estadoDocumentoVariant } from '@/lib/constants/variants'
import styles from '@/app/dashboard.styles'
import { useDashboardNow } from './useDashboardNow'
import { useZonaHoraria } from '@/lib/queries/useZonaHoraria'
import { DEFAULT_TIME_ZONE, partesEnZona } from '@/lib/timeZone'
import { formatoFechaPlazo } from './plazos'

const ORDEN_DOC = ['Publicado', 'Borrador', 'En Revisión', 'Archivado']

export default function DocumentosTab() {
  const { data: filas, isPending, isFetching, error, refetch } = useDocumentosAnalisis()
  const ahora = useDashboardNow()
  const zonaQuery = useZonaHoraria()
  const zona = zonaQuery.data ?? DEFAULT_TIME_ZONE
  const anio = partesEnZona(ahora, zona).anio
  const versiones = useVersionesAnalisis(zonaQuery.data, anio)
  const c = uiColors()

  const colorEstado = useMemo(() => {
    const mapa: Record<string, string> = { Publicado: c.success, Borrador: c.warning, 'En Revisión': c.info, Archivado: c.secondary }
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
      .sort((a, b) => {
        const i = ORDEN_DOC.indexOf(a.etiqueta)
        const j = ORDEN_DOC.indexOf(b.etiqueta)
        if (i === -1 && j === -1) return b.total - a.total
        if (i === -1) return 1
        if (j === -1) return -1
        return i - j
      })
  }, [filas])
  const totalEstado = useMemo(() => porEstado.reduce((sum, e) => sum + e.total, 0), [porEstado])
  const donutData = useMemo(() => ({
    labels: porEstado.map((e) => e.etiqueta),
    datasets: [{ data: porEstado.map((e) => e.total), backgroundColor: porEstado.map((e) => colorEstado[e.etiqueta] ?? c.muted), borderWidth: 0 }],
  }), [porEstado, colorEstado, c])

  const cambios = useMemo(() => versiones.data ?? [], [versiones.data])
  const cambiosData = useMemo(() => ({
    labels: cambios.map((c) => c.mes),
    datasets: [{ label: 'Cambios', data: cambios.map((c) => c.total), borderColor: c.primary, backgroundColor: c.primary, tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2 }],
  }), [cambios, c])
  const totalCambios = useMemo(() => cambios.reduce((sum, c) => sum + c.total, 0), [cambios])

  const porTipo = useMemo(() => contarPor(filas ?? [], (f) => f.categoria ?? f.titulo).slice(0, 8), [filas])
  const tipoData = useMemo(() => ({
    labels: porTipo.map((t) => t.etiqueta),
    datasets: [{ label: 'Documentos', data: porTipo.map((t) => t.total), backgroundColor: c.primary, borderRadius: 3, maxBarThickness: 16 }],
  }), [porTipo, c])

  const borradores = useMemo(() => {
    const rows = (filas ?? []).filter((f) => f.estado === 'Borrador')
    const serie = seriesDelAnio(rows, (f) => f.created_at, ahora, zona)
    return { ...serie, total: serie.valores.reduce((suma, valor) => suma + valor, 0) }
  }, [filas, ahora, zona])
  const borradorData = useMemo(() => ({
    labels: borradores.meses,
    datasets: [{ label: 'Borradores', data: borradores.valores, backgroundColor: c.warning, borderRadius: 2, maxBarThickness: 18 }],
  }), [borradores, c])

  const atencion = useMemo(() => (filas ?? [])
    .filter((f) => f.estado === 'Borrador')
    .sort((a, b) => (new Date(b.created_at ?? '0').getTime()) - (new Date(a.created_at ?? '0').getTime()))
    .slice(0, 8), [filas])

  if (error) {
    return <ErrorState error={error} title="No se pudieron cargar los datos del módulo de documentos" onRetry={() => void refetch()} retrying={isFetching} />
  }
  if (zonaQuery.error) return <ErrorState error={zonaQuery.error} title="No se pudo cargar la zona horaria" onRetry={() => void zonaQuery.refetch()} retrying={zonaQuery.isFetching} />
  if (isPending || !filas || zonaQuery.isPending) {
    return <div role="status" className={styles.empty}><Spinner color="primary" /></div>
  }

  return (
    <div role="tabpanel">
      <GridRow className="tw:gap-4 tw:mb-6">
        <GridCol xs={12} lg={4}>
          <Panel title="Documentos por estado">
            {porEstado.length === 0 ? (
              <ChartEmpty mensaje="No hay documentos registrados." />
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
                  <div className={styles.donutTotal}><strong>{totalEstado}</strong><span>Docs.</span></div>
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
        <GridCol xs={12} lg={8}>
          <Panel title={`Cambios documentales por mes en ${anio}`}>
            {versiones.error ? (
              <ErrorState error={versiones.error} title="No se pudieron cargar los cambios documentales" onRetry={() => void versiones.refetch()} retrying={versiones.isFetching} />
            ) : versiones.isPending ? (
              <div role="status" className={styles.empty}><Spinner color="primary" /></div>
            ) : totalCambios === 0 ? (
              <ChartEmpty mensaje="No hay cambios documentales registrados este año." />
            ) : (
              <div className={styles.chartLarge}>
                <Chart
                  type="line"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={`Cambios documentales por mes · total ${totalCambios}`}
                  data={cambiosData}
                  options={opcionesLinea(c) as never}
                />
              </div>
            )}
          </Panel>
        </GridCol>
      </GridRow>

      <GridRow className="tw:gap-4 tw:mb-6">
        <GridCol xs={12} lg={6}>
          <Panel title="Documentos por tipo">
            {porTipo.length === 0 ? (
              <ChartEmpty mensaje="No hay documentos registrados." />
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
        <GridCol xs={12} lg={6}>
          <Panel title={`Documentos en Borrador por mes en ${anio}`}>
            {borradores.total === 0 ? (
              <ChartEmpty mensaje="No hay documentos en Borrador creados este año." />
            ) : (
              <div className={styles.chartMedium}>
                <Chart
                  type="bar"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={`Borradores por mes · total ${borradores.total}`}
                  data={borradorData}
                  options={opcionesBarras(c) as never}
                />
              </div>
            )}
          </Panel>
        </GridCol>
      </GridRow>

      <Card className="tw:mb-6">
        <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
          <h2 className="tw:m-0 tw:text-xl">Documentos que requieren atención</h2>
          <Link href="/documentos" className="tw:font-medium tw:no-underline" style={{ fontSize: 14 }}>Ver todos los documentos</Link>
        </CardHeader>
        <CardContent className="tw:p-0">
          <DataTable hover responsive className="tw:mb-0 tw:align-middle">
            <TableHead>
              <tr>{['Documento', 'Versión', 'Estado', 'Actualizado'].map((label) => <TableHeaderCell key={label} scope="col">{label}</TableHeaderCell>)}</tr>
            </TableHead>
            <tbody>
              {atencion.length === 0 ? (
                <tr><TableCell colSpan={4}><div className={styles.emptyTable}>No hay documentos en Borrador.</div></TableCell></tr>
              ) : atencion.map((f) => (
                <tr key={f.id}>
                  <TableCell><strong className="tw:font-medium">{f.codigo_doc ?? 'Sin código'}</strong><div className="tw:text-sm tw:text-muted">{f.titulo}</div></TableCell>
                  <TableCell>{f.version_actual ?? '—'}</TableCell>
                  <TableCell><Badge variant={estadoDocumentoVariant[f.estado] ?? 'gray'}>{f.estado}</Badge></TableCell>
                  <TableCell className="tw:whitespace-nowrap">{f.created_at ? formatoFechaPlazo(f.created_at, zona) : '—'}</TableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  )
}
