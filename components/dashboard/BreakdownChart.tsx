'use client'

import { useMemo } from 'react'
import type { Plugin } from 'chart.js'
import Chart from './Chart'
import { ChartEmpty, opcionesBarras, uiColors, type ColorSemantico } from './chartKit'
import styles from '@/app/dashboard.styles'

interface Fila { etiqueta: string; total: number; color?: ColorSemantico | 'purple' }

/** Gráfico CoreUI de cantidades reales. Los valores se dibujan al final de cada
 * barra para leerlos sin hover; el eje horizontal siempre representa registros.
 */
export default function BreakdownChart({ filas, nombre = 'Registros' }: { filas: Fila[]; nombre?: string }) {
  const c = uiColors()
  const filasVisibles = useMemo(() => filas.filter((fila) => fila.total >= 0), [filas])
  const datos = useMemo(() => ({
    labels: filasVisibles.map((fila) => fila.etiqueta),
    datasets: [{ label: nombre, data: filasVisibles.map((fila) => fila.total),
      backgroundColor: filasVisibles.map((fila) => c[fila.color ?? 'primary']),
      borderRadius: 4, maxBarThickness: 24 }],
  }), [filasVisibles, c, nombre])
  const valores: Plugin<'bar'> = useMemo(() => ({
    id: 'dashboardValoresBarra',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx
      ctx.save()
      ctx.fillStyle = c.body
      ctx.font = '600 14px sans-serif'
      ctx.textBaseline = 'middle'
      chart.getDatasetMeta(0).data.forEach((barra, index) => {
        ctx.fillText(String(filasVisibles[index]?.total ?? 0), barra.x + 7, barra.y)
      })
      ctx.restore()
    },
  }), [c.body, filasVisibles])

  if (!filasVisibles.some((fila) => fila.total > 0)) return <ChartEmpty mensaje="No hay registros para este gráfico." />
  const opciones = opcionesBarras(c, { horizontal: true })
  const altura = Math.max(210, filasVisibles.length * 47 + 48)
  return <div className={styles.breakdownChart} style={{ height: altura }}>
    <Chart type="bar" wrapper={false} customTooltips={false} role="img"
      aria-label={`${nombre}: ${filasVisibles.map((fila) => `${fila.etiqueta} ${fila.total}`).join(', ')}`}
      data={datos} plugins={[valores]} options={{ ...opciones, layout: { padding: { right: 38 } } } as never} />
  </div>
}
