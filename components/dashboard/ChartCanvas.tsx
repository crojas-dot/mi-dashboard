'use client'
import { useEffect, useRef, type ComponentPropsWithRef } from 'react'
import { Chart as ChartJS, BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, DoughnutController, ArcElement, Tooltip, Legend, Filler, type ChartData, type ChartOptions, type ChartType, type Plugin } from 'chart.js'

// This is the only runtime Chart.js import. Next/dynamic keeps it out of the shell.
ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, DoughnutController, ArcElement, Tooltip, Legend, Filler)
export interface ChartProps extends Omit<ComponentPropsWithRef<'canvas'>, 'data' | 'ref'> {
  type: ChartType; data: ChartData; options?: ChartOptions; plugins?: Plugin[]
  wrapper?: boolean; customTooltips?: boolean
}
export default function ChartCanvas({ type, data, options, plugins, wrapper: _wrapper, customTooltips: _tooltips, ...props }: ChartProps) {
  void _wrapper; void _tooltips
  const canvas = useRef<HTMLCanvasElement>(null), chart = useRef<ChartJS | null>(null)
  useEffect(() => {
    if (!canvas.current) return
    const instance = new ChartJS(canvas.current, { type, data, options, plugins })
    chart.current = instance
    return () => { instance.destroy(); chart.current = null }
    // Updating data does not recreate the canvas or listeners. Plugins/type do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, plugins])
  useEffect(() => {
    if (!chart.current) return
    chart.current.data = data
    chart.current.options = options ?? {}
    chart.current.update('none')
  }, [data, options])
  return <canvas role="img" {...props} ref={canvas} />
}
