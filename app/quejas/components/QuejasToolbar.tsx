'use client'

import { Eye, Plus, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'

interface QuejasToolbarProps {
  search: string
  estado: string
  prioridad: string
  estados: { valor: string }[]
  prioridades: { valor: string }[]
  noVistas: number
  onSearch: (value: string) => void
  onEstado: (value: string) => void
  onPrioridad: (value: string) => void
  onMarcarVistas: () => void
  onNueva: () => void
}

/** Distribución según el espacio disponible en el módulo, no el ancho de la ventana. */
export default function QuejasToolbar({ search, estado, prioridad, estados, prioridades, noVistas, onSearch, onEstado, onPrioridad, onMarcarVistas, onNueva }: QuejasToolbarProps) {
  return <div className="@container mb-4 shrink-0">
    <div role="group" aria-label="Buscar y filtrar quejas" className={`grid grid-cols-2 items-center gap-3 ${noVistas > 0 ? '@min-[860px]:grid-cols-[auto_minmax(180px,1fr)_160px_140px_auto]' : '@min-[860px]:grid-cols-[minmax(180px,1fr)_160px_140px_auto]'}`}>
      {noVistas > 0 && <Button variant="secondary" onClick={onMarcarVistas} title="Marcar todas las quejas visibles como vistas" className="order-last col-span-2 min-h-11 justify-self-start text-xs @min-[860px]:order-none @min-[860px]:col-span-1 @min-[860px]:min-h-10">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />{noVistas} sin ver
      </Button>}
      <div className="relative col-span-2 min-w-0 @min-[860px]:col-span-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-qms-muted" aria-hidden="true" />
        <input placeholder="Buscar folio o cliente..." aria-label="Buscar folio o cliente" className="ui-field h-11 pl-10 pr-4 @min-[860px]:h-10" value={search} onChange={event => onSearch(event.target.value)} />
      </div>
      <Select aria-label="Estado" className="h-11 @min-[860px]:h-10" value={estado} onChange={event => onEstado(event.target.value)}>
        <option value="">Estados</option>{estados.map(option => <option key={option.valor} value={option.valor}>{option.valor}</option>)}
      </Select>
      <Select aria-label="Prioridad" className="h-11 @min-[860px]:h-10" value={prioridad} onChange={event => onPrioridad(event.target.value)}>
        <option value="">Prioridad</option>{prioridades.map(option => <option key={option.valor} value={option.valor}>{option.valor}</option>)}
      </Select>
      <Button onClick={onNueva} className="col-span-2 min-h-11 w-full @min-[860px]:col-span-1 @min-[860px]:min-h-10 @min-[860px]:w-auto"><Plus className="h-4 w-4" aria-hidden="true" />Nueva queja</Button>
    </div>
  </div>
}
