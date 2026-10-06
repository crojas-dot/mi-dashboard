'use client'
import dynamic from 'next/dynamic'

function ChartLoading() {
  return <span className="visually-hidden" role="status">Cargando gráfico…</span>
}

// Chart.js se importa bajo demanda al montarse; los contenedores del dashboard
// reservan su tamaño. No hacer imports estáticos de estos componentes en las vistas.
const CChart = dynamic(
  () => import('@coreui/react-chartjs').then((module) => module.CChart),
  { ssr: false, loading: ChartLoading },
)

export default CChart