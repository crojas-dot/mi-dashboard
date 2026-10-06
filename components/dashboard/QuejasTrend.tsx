'use client'
import { DataTable } from '@/components/ui/tailwind/DataTable'
import { TableHead } from '@/components/ui/tailwind/Table'
import { TableHeaderCell } from '@/components/ui/tailwind/Table'
import { TableCell } from '@/components/ui/tailwind/Table'

import { useMemo } from 'react'

import type { MesSerie } from '@/lib/queries/useQuejasAnalisis'
import Chart from './Chart'
import { ChartEmpty, conAlpha, opcionesLinea, uiColors } from './chartKit'
import styles from '@/app/dashboard.styles'

/** Una sola presentación para General y Quejas. `resueltas` viene del hook
 * histórico, pero cuenta fecha_cierre: la etiqueta visible debe decir cierres.
 * Mantener meses con cero evita dibujar una continuidad temporal falsa.
 */
export default function QuejasTrend({ series, anio }: { series: MesSerie[]; anio: number }) {
  const c = uiColors()
  const data = useMemo(() => ({
    labels: series.map((mes) => mes.mes),
    datasets: [
      { label: 'Recibidas', data: series.map((mes) => mes.recibidas), borderColor: c.info, backgroundColor: conAlpha(c.info, 0.16), tension: 0.3, fill: true, pointRadius: 3, pointHoverRadius: 6, borderWidth: 2 },
      { label: 'Cierres', data: series.map((mes) => mes.resueltas), borderColor: c.success, backgroundColor: c.success, tension: 0.3, fill: false, pointRadius: 3, pointHoverRadius: 6, borderWidth: 2 },
    ],
  }), [series, c])

  if (!series.length) return <ChartEmpty mensaje="No hay datos para mostrar la evolución de quejas." />

  return <>
    <p className={styles.chartNote}>Año {anio}: cada mes muestra nuevas quejas y cierres registrados. El mes actual está en curso.</p>
    <div className={styles.chartLarge}>
      <Chart type="line" wrapper={false} customTooltips={false} role="img"
        aria-label={`Quejas recibidas y cerradas por mes de ${anio}. Las cantidades están disponibles en la tabla inferior.`}
        data={data} options={opcionesLinea(c) as never} />
    </div>
    <div className="tw:mt-4">
      <details>
        <summary>Ver cantidades por mes</summary>
        <div>
          <DataTable small responsive className="tw:mb-0 tw:align-middle" aria-label="Cantidades mensuales de quejas">
            <TableHead><tr>
              <TableHeaderCell scope="col">Mes</TableHeaderCell>
              <TableHeaderCell scope="col" className="tw:text-right">Recibidas</TableHeaderCell>
              <TableHeaderCell scope="col" className="tw:text-right">Cierres</TableHeaderCell>
            </tr></TableHead>
            <tbody>{series.map((mes) => <tr key={mes.mes}>
              <TableHeaderCell scope="row">{mes.mes}</TableHeaderCell>
              <TableCell className="tw:text-right">{mes.recibidas}</TableCell>
              <TableCell className="tw:text-right">{mes.resueltas}</TableCell>
            </tr>)}</tbody>
          </DataTable>
        </div>
      </details>
    </div>
  </>
}
