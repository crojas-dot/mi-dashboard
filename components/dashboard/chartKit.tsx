'use client'
import { Card } from '@/components/ui/tailwind/Card'
import { CardHeader } from '@/components/ui/tailwind/Card'
import { CardContent } from '@/components/ui/tailwind/Card'


import { chartColors, type ChartColors } from './chartColors'
import { mesYAnioEnZona, mesesDelAnio } from '@/lib/timeZone'

/** Estado vacío limpio cuando no hay datos suficientes para un gráfico. */
export function ChartEmpty({ mensaje = 'No hay datos suficientes para mostrar esta tendencia.' }: { mensaje?: string }) {
  return (
    <div className="tw:flex tw:items-center tw:justify-center tw:py-12">
      <p className="tw:text-muted tw:text-center tw:mb-0">{mensaje}</p>
    </div>
  )
}

/** Tarjeta CoreUI estándar del dashboard (Card + CardHeader + CardContent). */
export function Panel({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="tw:h-full">
      <CardHeader className="tw:flex tw:items-center tw:justify-between tw:flex-wrap tw:gap-2">
        <h2 className="tw:m-0 tw:text-xl">{title}</h2>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export type ColorSemantico = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary'

const BORDES: Record<ColorSemantico, string> = {
  success: 'tw:border-s-qms-success',
  warning: 'tw:border-s-qms-warning',
  danger: 'tw:border-s-qms-danger',
  info: 'tw:border-s-qms-info',
  primary: 'tw:border-s-primary',
  secondary: 'tw:border-s-muted',
}

/** Pequeña métrica integrada dentro de un panel (patrón CoreUI border-start). */
export function PanelMetric({ color, etiqueta, valor }: { color: ColorSemantico; etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className={`tw:border-s tw:border-s-4 ${BORDES[color]} tw:py-1 tw:px-4`}>
      <div className="tw:text-sm tw:text-muted tw:uppercase tw:font-semibold">{etiqueta}</div>
      <div className="tw:text-xl tw:font-semibold tw:leading-none">{valor}</div>
    </div>
  )
}

/** Aplica transparencia a un color de la paleta (hex o rgb), como los charts del template CoreUI. */
export function conAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgb')) {
    return color.replace(/^rgb(a?)\(/, 'rgba(').replace(/\)$/, `, ${alpha})`)
  }
  const limpio = color.replace('#', '')
  const hex = limpio.length === 3 ? limpio.split('').map((h) => h + h).join('') : limpio
  const valor = parseInt(hex, 16)
  if (Number.isNaN(valor)) return color
  return `rgba(${(valor >> 16) & 255}, ${(valor >> 8) & 255}, ${valor & 255}, ${alpha})`
}

/** Serie de línea con el look del template CoreUI (Charts.jsx/MainChart): área translúcida opcional,
 * puntos del color de la serie con borde blanco. La curva suave y los puntos los fija opcionesLinea. */
export function serieLinea(c: ChartColors, color: string, label: string, data: number[], relleno = false) {
  return {
    label,
    data,
    backgroundColor: relleno ? conAlpha(color, 0.2) : 'transparent',
    borderColor: color,
    pointBackgroundColor: color,
    pointBorderColor: '#fff',
    pointBorderWidth: 2,
    borderWidth: 2,
    fill: relleno,
  }
}

/** Opciones compartidas de Chart.js (evitar duplicar configuración). Líneas suaves y puntos visibles
 * para seguir cada mes; el grid vertical suave delimita los meses en la escala X. */
export function opcionesLinea(c: ChartColors, { buscar = true }: { buscar?: boolean } = {}) {
  return {
    maintainAspectRatio: false,
    animation: false,
    interaction: buscar ? ({ mode: 'index', intersect: false } as const) : undefined,
    elements: {
      line: { tension: 0.4 },
      point: { radius: 3, hitRadius: 6, hoverRadius: 4, hoverBorderWidth: 2 },
    },
    plugins: {
      legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 14 } } },
    },
    scales: {
      x: { grid: { color: c.grid }, ticks: { color: c.muted, font: { size: 14 } } },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Cantidad', color: c.muted, font: { size: 14 } },
        ticks: { precision: 0, color: c.muted, font: { size: 14 } },
        grid: { color: c.grid },
      },
    },
  }
}

export function opcionesBarras(c: ChartColors, { apilado = false, horizontal = false, leyenda = false }: { apilado?: boolean; horizontal?: boolean; leyenda?: boolean } = {}) {
  const ejesX = horizontal
    ? { beginAtZero: true, stacked: apilado, ticks: { precision: 0, color: c.muted, font: { size: 14 } }, grid: { color: c.grid } }
    : { stacked: apilado, grid: { display: false }, ticks: { color: c.muted, font: { size: 14 } } }
  const ejesY = horizontal
    ? { stacked: apilado, grid: { display: false }, ticks: { color: c.muted, font: { size: 14 } } }
    : { beginAtZero: true, stacked: apilado, ticks: { precision: 0, color: c.muted, font: { size: 14 } }, grid: { color: c.grid } }
  return {
    maintainAspectRatio: false,
    animation: false,
    indexAxis: horizontal ? ('y' as const) : ('x' as const),
    plugins: {
      legend: leyenda ? { display: true, position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 14 } } } : { display: false },
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

/** Un calendario para todos los tabs: enero → mes actual de la zona seleccionada. */
export function seriesDelAnio<T>(filas: T[], extraerFecha: (fila: T) => string | null | undefined,
  ahora: number, zona: string): { anio: number; meses: string[]; valores: number[] } {
  const { anio, meses } = mesesDelAnio(ahora, zona)
  const valores = Array<number>(meses.length).fill(0)
  for (const fila of filas) {
    const fecha = mesYAnioEnZona(extraerFecha(fila), zona)
    if (fecha?.anio === anio && fecha.mes >= 1 && fecha.mes <= meses.length) valores[fecha.mes - 1] += 1
  }
  return { anio, meses, valores }
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
export function uiColors(): ChartColors {
  return chartColors()
}
