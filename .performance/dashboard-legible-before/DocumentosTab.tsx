'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  CSpinner,
  CRow,
  CCol,
  CCard,
  CCardHeader,
  CCardBody,
  CTable,
  CTableHead,
  CTableHeaderCell,
  CTableBody,
  CTableRow,
  CTableDataCell,
} from '@coreui/react'
import ErrorState from '@/components/ui/ErrorState'
import Badge from '@/components/ui/Badge'
import CChart from './Chart'
import { ChartEmpty, Panel, contarPor, opcionesBarras, opcionesDonut, opcionesLinea, seriesMensuales, uiColors } from './chartKit'
import { useDocumentosAnalisis, useVersionesAnalisis } from '@/lib/queries/useModulosAnalisis'
import { estadoDocumentoVariant } from '@/lib/constants/variants'
import styles from '@/app/dashboard.module.css'

const ORDEN_DOC = ['Publicado', 'Borrador', 'En Revisión', 'Archivado']

export default function DocumentosTab() {
  const { data: filas, isPending, isFetching, error, refetch } = useDocumentosAnalisis()
  const versiones = useVersionesAnalisis()
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
    const { meses, valores } = seriesMensuales(rows, (f) => f.created_at ? new Date(f.created_at).toISOString() : null, 11)
    return { meses, valores, total: rows.length }
  }, [filas])
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
  if (isPending || !filas) {
    return <div role="status" className={styles.empty}><CSpinner color="primary" /></div>
  }

  return (
    <div role="tabpanel">
      <CRow className="g-3 mb-4">
        <CCol xs={12} lg={4}>
          <Panel title="Documentos por estado">
            {porEstado.length === 0 ? (
              <ChartEmpty mensaje="No hay documentos registrados." />
            ) : (
              <>
                <div className={styles.donut}>
                  <CChart
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
        </CCol>
        <CCol xs={12} lg={8}>
          <Panel title="Cambios documentales por mes">
            {versiones.isPending ? (
              <div role="status" className={styles.empty}><CSpinner color="primary" /></div>
            ) : totalCambios === 0 ? (
              <ChartEmpty mensaje="No hay cambios documentales registrados en los últimos 12 meses." />
            ) : (
              <div className={styles.chartLarge}>
                <CChart
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
        </CCol>
      </CRow>

      <CRow className="g-3 mb-4">
        <CCol xs={12} lg={6}>
          <Panel title="Documentos por tipo">
            {porTipo.length === 0 ? (
              <ChartEmpty mensaje="No hay documentos registrados." />
            ) : (
              <div className={styles.chartMedium}>
                <CChart
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
        </CCol>
        <CCol xs={12} lg={6}>
          <Panel title="Documentos en Borrador por mes">
            {borradores.total === 0 ? (
              <ChartEmpty mensaje="No hay documentos en Borrador." />
            ) : (
              <div className={styles.chartMedium}>
                <CChart
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
        </CCol>
      </CRow>

      <CCard className="mb-4">
        <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h2 className="m-0 fs-5">Documentos que requieren atención</h2>
          <Link href="/documentos" className="fw-medium text-decoration-none" style={{ fontSize: 14 }}>Ver todos los documentos</Link>
        </CCardHeader>
        <CCardBody className="p-0">
          <CTable hover responsive className="mb-0 align-middle">
            <CTableHead>
              <CTableRow>{['Documento', 'Versión', 'Estado', 'Actualizado'].map((label) => <CTableHeaderCell key={label} scope="col">{label}</CTableHeaderCell>)}</CTableRow>
            </CTableHead>
            <CTableBody>
              {atencion.length === 0 ? (
                <CTableRow><CTableDataCell colSpan={4}><div className={styles.emptyTable}>No hay documentos en Borrador.</div></CTableDataCell></CTableRow>
              ) : atencion.map((f) => (
                <CTableRow key={f.id}>
                  <CTableDataCell><strong className="fw-medium">{f.codigo_doc ?? 'Sin código'}</strong><div className="small text-body-secondary">{f.titulo}</div></CTableDataCell>
                  <CTableDataCell>{f.version_actual ?? '—'}</CTableDataCell>
                  <CTableDataCell><Badge variant={estadoDocumentoVariant[f.estado] ?? 'gray'}>{f.estado}</Badge></CTableDataCell>
                  <CTableDataCell className="text-nowrap">{f.created_at ? new Date(f.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}</CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </div>
  )
}