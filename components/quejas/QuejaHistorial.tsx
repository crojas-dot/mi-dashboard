import Button from '@/components/ui/Button'
import type { QuejaMovimiento } from '@/lib/queries/useQuejaHistorial'

const CELDA = 'h-10 border-r border-b border-qms-border px-2 align-middle last:border-r-0 sm:px-3'
const TEXTO = 'line-clamp-2 wrap-anywhere'
const FECHA = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: '2-digit',
})
const HORA = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export default function QuejaHistorial({ movimientos, loading, error, onRetry }: {
  movimientos: QuejaMovimiento[]
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  return <table aria-label="Historial del expediente" aria-busy={loading} className="w-full table-fixed border-separate border-spacing-0 border-x border-t border-qms-border bg-qms-surface text-left text-xs leading-4">
    <colgroup><col className="w-1/4" /><col className="w-[4.75rem] sm:w-[8.25rem]" /><col /></colgroup>
    <thead className="sticky top-0 z-10 bg-qms-table-head text-qms-muted">
      <tr>
        <th scope="col" className={CELDA}>Usuario</th>
        <th scope="col" className={CELDA}>Fecha</th>
        <th scope="col" className={CELDA}><span className={TEXTO}>Acción realizada</span></th>
      </tr>
    </thead>
    <tbody>
      {movimientos.map(item => {
        const fecha = new Date(item.fecha)
        const [dia, hora] = Number.isFinite(fecha.getTime()) ? [FECHA.format(fecha), HORA.format(fecha)] : ['—', '']
        return <tr key={item.id} className="hover:bg-qms-hover-bg">
          <td className={CELDA}><span className={TEXTO} title={item.usuario ?? undefined}>{item.usuario || '—'}</span></td>
          <td className={CELDA + ' text-qms-muted tabular-nums'}>
            <time dateTime={item.fecha} title={[dia, hora].filter(Boolean).join(' ')}
              className="block whitespace-nowrap sm:flex sm:items-center sm:gap-1.5">
              <span className="block">{dia}</span>{' '}<span className="block">{hora}</span>
            </time>
          </td>
          <td className={CELDA}><span className={TEXTO} title={item.accion}>{item.accion}</span></td>
        </tr>
      })}
      {error ? <tr><td colSpan={3} className={CELDA}><div role="alert" className="flex items-center gap-2">
        <span className={TEXTO}>No se pudo cargar el historial.</span><Button size="sm" variant="link" onClick={onRetry}>Reintentar</Button>
      </div></td></tr>
        : !movimientos.length && <tr><td colSpan={3} className={CELDA + ' text-qms-muted'}>
          <span role="status">{loading ? 'Cargando historial…' : 'Sin movimientos registrados.'}</span>
        </td></tr>}
    </tbody>
  </table>
}
