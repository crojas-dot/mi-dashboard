import { formatFechaIngreso } from '@/lib/utils/quejaBandeja'

interface Props {
  fecha: string
  contexto?: string | null
  reciente?: boolean
}

/** La segunda línea ocupa el espacio interior existente, nunca agranda la fila. */
export default function QuejaFechaIngreso({ fecha, contexto, reciente = false }: Props) {
  return <div className={`relative leading-6 ${contexto ? '-translate-y-2' : ''}`}>
    <span className="font-normal text-[#475569]">{formatFechaIngreso(fecha)}</span>
    {contexto && <span data-queja-contexto className={`absolute left-0 top-full whitespace-nowrap text-[13px] leading-4 ${reciente ? 'font-medium text-qms-primary' : 'font-normal text-[#64748b]'}`}>
      {contexto}
    </span>}
  </div>
}
