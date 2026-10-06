'use client'

import { useMemo, useState } from 'react'
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
import { ChartEmpty, Panel, PanelMetric, contarPor, opcionesBarras, opcionesDonut, opcionesLinea, seriesMensuales, uiColors } from './chartKit'
import { useSacpAnalisis } from '@/lib/queries/useModulosAnalisis'
import { estadoSACPVariant, prioridadVariant } from '@/lib/constants/variants'
import styles from '@/app/dashboard.module.css'

const ORDEN_SACP = ['Abierta', 'En Proceso', 'En Validación', 'Cerrada']
const COLOR_SACP: Record<string, string> = { Abierta: 'info', 'En Proceso': 'warning', 'En Validación': 'primary', Cerrada: 'success' }

export default function SacpTab() {
  const { data: filas, isPending, isFetching, error, refetch } = useSacpAnalisis()
  const [ahora] = useState(() => Date.now())
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

  const creadas = useMemo(() => seriesMensuales(filas ?? [], (f) => f.fecha_apertura, 11), [filas])
  const serieData = useMemo(() => ({
    labels: creadas.meses,
    datasets: [{ label: 'Creadas', data: creadas.valores, borderColor: c.primary, backgroundColor: c.primary, tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2 }],
  }), [creadas, c])
  const creadasMes = (filas ?? []).filter((f) => {
    if (!f.fecha_apertura) return false
    const d = new Date(f.fecha_apertura)
    const ahoraD = new Date()
    return d.getFullYear() === ahoraD.getFullYear() && d.getMonth() === ahoraD.getMonth()
  }).length

  const plazos = useMemo(() => {
    const b = { Vencidas: 0, 'Próximas a vencer': 0, 'A tiempo': 0, Cumplidas: 0 }
    for (const f of filas ?? []) {
      if (f.estado === 'Cerrada') { b.Cumplidas += 1; continue }
      if (!f.fecha_limite) continue
      const dias = Math.floor((new Date(f.fecha_limite).getTime() - ahora) / 86400000)
      if (dias < 0) b.Vencidas += 1
      else if (dias <= 7) b['Próximas a vencer'] += 1
      else b['A tiempo'] += 1
    }
    return b
  }, [filas, ahora])
  const plazosData = useMemo(() => ({
    labels: ['Vencidas', 'Próximas a vencer', 'A tiempo', 'Cumplidas'],
    datasets: [{ data: [plazos.Vencidas, plazos['Próximas a vencer'], plazos['A tiempo'], plazos.Cumplidas], backgroundColor: [c.danger, c.warning, c.info, c.success], borderRadius: 2, maxBarThickness: 18 }],
  }), [plazos, c])

  const porTipo = useMemo(() => contarPor(filas ?? [], (f) => f.tipo).slice(0, 8), [filas])
  const totalPlazos = plazos.Vencidas + plazos['Próximas a vencer'] + plazos['A tiempo'] + plazos.Cumplidas
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
  if (isPending || !filas) {
    return <div role="status" className={styles.empty}><CSpinner color="primary" /></div>
  }

  return (
    <div role="tabpanel">
      <CRow className="g-3 mb-4">
        <CCol xs={12} lg={8}>
          <Panel title="SACP creadas por mes" action={<PanelMetric color="primary" etiqueta="Creadas este mes" valor={creadasMes} />}>
            {filas.length ? (
              <div className={styles.chartLarge}>
                <CChart
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
        </CCol>
        <CCol xs={12} lg={4}>
          <Panel title="SACP por estado">
            {porEstado.length === 0 ? (
              <ChartEmpty mensaje="No hay acciones SACP registradas." />
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
        </CCol>
      </CRow>

      <CRow className="g-3 mb-4">
        <CCol xs={12} lg={6}>
          <Panel title="Cumplimiento de plazos" action={
            <div className="d-flex gap-2 flex-wrap">
              <PanelMetric color="success" etiqueta="Cumplidas" valor={plazos.Cumplidas} />
              <PanelMetric color="warning" etiqueta="Próx. vencer" valor={plazos['Próximas a vencer']} />
              <PanelMetric color="danger" etiqueta="Vencidas" valor={plazos.Vencidas} />
            </div>
          }>
            {totalPlazos === 0 ? (
              <ChartEmpty mensaje="No hay acciones con fecha límite." />
            ) : (
              <div className={styles.chartMedium}>
                <CChart
                  type="bar"
                  wrapper={false}
                  customTooltips={false}
                  role="img"
                  aria-label={`Plazos · cumplidas ${plazos.Cumplidas}, a tiempo ${plazos['A tiempo']}, próximas a vencer ${plazos['Próximas a vencer']}, vencidas ${plazos.Vencidas}`}
                  data={plazosData}
                  options={opcionesBarras(c, { horizontal: true }) as never}
                />
              </div>
            )}
          </Panel>
        </CCol>
        <CCol xs={12} lg={6}>
          <Panel title="SACP por tipo">
            {porTipo.length === 0 ? (
              <ChartEmpty mensaje="No hay acciones SACP registradas." />
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
      </CRow>

      <CCard className="mb-4">
        <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h2 className="m-0 fs-5">SACP que requieren atención</h2>
          <Link href="/sacp" className="fw-medium text-decoration-none" style={{ fontSize: 14 }}>Ver todas las acciones</Link>
        </CCardHeader>
        <CCardBody className="p-0">
          <CTable hover responsive className="mb-0 align-middle">
            <CTableHead>
              <CTableRow>{['Folio', 'Tipo', 'Estado', 'Prioridad', 'Vencimiento'].map((label) => <CTableHeaderCell key={label} scope="col">{label}</CTableHeaderCell>)}</CTableRow>
            </CTableHead>
            <CTableBody>
              {atencion.length === 0 ? (
                <CTableRow><CTableDataCell colSpan={5}><div className={styles.emptyTable}>No hay acciones pendientes de cierre.</div></CTableDataCell></CTableRow>
              ) : atencion.map((f) => (
                <CTableRow key={f.id}>
                  <CTableDataCell><Link href="/sacp" className={styles.folio}>{f.folio ?? '—'}</Link></CTableDataCell>
                  <CTableDataCell>{f.tipo}{f.descripcion ? <div className="small text-body-secondary">{f.descripcion.slice(0, 48)}{f.descripcion.length > 48 ? '…' : ''}</div> : null}</CTableDataCell>
                  <CTableDataCell><Badge variant={estadoSACPVariant[f.estado] ?? 'gray'}>{f.estado}</Badge></CTableDataCell>
                  <CTableDataCell>{f.prioridad ? <Badge variant={prioridadVariant[f.prioridad] ?? 'gray'}>{f.prioridad}</Badge> : '—'}</CTableDataCell>
                  <CTableDataCell className="text-nowrap">{f.fecha_limite ? new Date(f.fecha_limite).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Sin fecha'}</CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </div>
  )
}