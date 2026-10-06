'use client'

import { CCard, CCardHeader, CCardBody } from '@coreui/react'
import { cuiColors, type CuiColors } from './cuiColors'

/** Estado vacío limpio cuando no hay datos suficientes para un gráfico. */
export function ChartEmpty({ mensaje = 'No hay datos suficientes para mostrar esta tendencia.' }: { mensaje?: string }) {
  return (
    <div className="d-flex align-items-center justify-content-center py-5">
      <p className="text-body-secondary text-center mb-0">{mensaje}</p>
    </div>
  )
}

/** Tarjeta CoreUI estándar del dashboard (CCard + CCardHeader + CCardBody). */
export function Panel({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <CCard className="h-100">
      <CCardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 className="m-0 fs-5">{title}</h2>
        {action}
      </CCardHeader>
      <CCardBody>{children}</CCardBody>
    </CCard>
  )
}

export type ColorSemantico = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary'

const BORDES: Record<ColorSemantico, string> = {
  success: 'border-start-success',
  warning: 'border-start-warning',
  danger: 'border-start-danger',
  info: 'border-start-info',
  primary: 'border-start-primary',
  secondary: 'border-start-secondary',
}

/** Pequeña métrica integrada dentro de un panel (patrón CoreUI border-start). */
export function PanelMetric({ color, etiqueta, valor }: { color: ColorSemantico; etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className={`border-start border-start-4 ${BORDES[color]} py-1 px-3`}>
      <div className="small text-body-secondary text-uppercase fw-semibold">{etiqueta}</div>
      <div className="fs-5 fw-semibold lh-1">{valor}</div>
    </div>
  )
}

/** Opciones compartidas de Chart.js (evitar duplicar configuración). */
export function opcionesLinea(c: CuiColors, { buscar = false }: { buscar?: boolean } = {}) {
  return {
    maintainAspectRatio: false,
    animation: false,
    interaction: buscar ? ({ mode: 'index', intersect: false } as const) : undefined,
    plugins: {
      legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 13 } } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: c.muted, font: { size: 12 } } },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: c.muted, font: { size: 13 } },
        grid: { color: c.grid },
      },
    },
  }
}

export function opcionesBarras(c: CuiColors, { apilado = false, horizontal = false, leyenda = false }: { apilado?: boolean; horizontal?: boolean; leyenda?: boolean } = {}) {
  const ejesX = horizontal
    ? { beginAtZero: true, stacked: apilado, ticks: { precision: 0, color: c.muted, font: { size: 13 } }, grid: { color: c.grid } }
    : { stacked: apilado, grid: { display: false }, ticks: { color: c.muted, font: { size: 12 } } }
  const ejesY = horizontal
    ? { stacked: apilado, grid: { display: false }, ticks: { color: c.muted, font: { size: 13 } } }
    : { beginAtZero: true, stacked: apilado, ticks: { precision: 0, color: c.muted, font: { size: 13 } }, grid: { color: c.grid } }
  return {
    maintainAspectRatio: false,
    animation: false,
    indexAxis: horizontal ? ('y' as const) : ('x' as const),
    plugins: {
      legend: leyenda ? { display: true, position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 13 } } } : { display: false },
    },
    scales: { x: ejesX, y: ejesY },
  }
}

export function opcionesDonut() {
  return {
    maintainAspectRatio: false,
    animation: false,
    cutout: '70%',
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
  }
}

/** Serie mensual (últimos `meses` + el actual) a partir de las fechas de filas. */
export function seriesMensuales<T>(filas: T[], extraerFecha: (fila: T) => string | null | undefined, meses = 12): { meses: string[]; valores: number[] } {
  const ahora = new Date()
  const ejes = Array.from({ length: meses + 1 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - i), 1)
    return {
      clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      etiqueta: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).replace(/\.$/, ''),
    }
  })
  const conteo = new Map(ejes.map((e) => [e.clave, 0]))
  for (const fila of filas) {
    const fecha = extraerFecha(fila)
    if (!fecha) continue
    const d = new Date(fecha)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const actual = conteo.get(clave)
    if (actual !== undefined) conteo.set(clave, actual + 1)
  }
  return { meses: ejes.map((e) => e.etiqueta), valores: ejes.map((e) => conteo.get(e.clave) ?? 0) }
}

/** Conteo por agrupación, ordenado de mayor a menor. */
export function contarPor<T>(filas: T[], claveDe: (fila: T) => string | null | undefined): { etiqueta: string; total: number }[] {
  const mapa = new Map<string, number>()
  for (const fila of filas) {
    const clave = claveDe(fila)?.trim()
    if (!clave) continue
    mapa.set(clave, (mapa.get(clave) ?? 0) + 1)
  }
  return [...mapa.entries()].map(([etiqueta, total]) => ({ etiqueta, total })).sort((a, b) => b.total - a.total)
}

/** Reutilizado por los módulos de análisis del dashboard. */
export function uiColors(): CuiColors {
  return cuiColors()
}
