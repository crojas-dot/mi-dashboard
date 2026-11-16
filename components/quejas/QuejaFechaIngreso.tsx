import type { Queja } from '@/lib/types'
import { detalleFechaIngreso, fechaIngresoCorta } from '@/lib/utils/quejasListado'

/** Fecha de creación obligatoria; la segunda línea solo muestra actividad real. */
export default function QuejaFechaIngreso({ queja, ahora }: { queja: Queja; ahora?: number | Date }) {
  const detalle = detalleFechaIngreso(queja, ahora)
  return <div data-queja-fecha-ingreso className="flex h-9 min-w-0 flex-col justify-center gap-0.5">
    <time dateTime={queja.fecha} className="whitespace-nowrap text-base font-medium leading-[18px] text-qms-dark">
      {fechaIngresoCorta(queja.fecha)}
    </time>
    {detalle && <span className={`whitespace-nowrap text-xs leading-[15px] ${detalle.destacada ? 'font-semibold text-qms-primary' : 'font-normal text-qms-muted'}`}>
      {detalle.texto}
    </span>}
  </div>
}
