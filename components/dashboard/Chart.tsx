'use client'
import dynamic from 'next/dynamic'

function ChartLoading() {
  return <span className="tw:sr-only" role="status">Cargando gráfico…</span>
}

// Chart.js se importa bajo demanda al montarse; los contenedores del dashboard
// reservan su tamaño. No hacer imports estáticos de estos componentes en las vistas.
const Chart = dynamic(
  () => import('./ChartCanvas'),
  { ssr: false, loading: ChartLoading },
)

export default Chart
