'use client'

import { useId, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { MOTIVOS_AGENDA, type AgendaHoyItem } from '@/lib/constants/agenda'
import { crearMesAgenda, puntosAgenda } from '@/lib/utils/agendaCalendar'

interface Props {
  open: boolean
  items: readonly AgendaHoyItem[]
  loading?: boolean
  error?: boolean
  onToggle: () => void
  onClose: () => void
  onRetry: () => void
}

/** Presentación controlada: la cabecera mantiene una sola ventana abierta. */
export default function AgendaHoyWidget({ open, items, loading, error, onToggle, onClose, onRetry }: Props) {
  const id = useId()
  const [vista, setVista] = useState<'calendario' | 'agenda'>('calendario')
  const [offsetMes, setOffsetMes] = useState(0)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const accionVista = useRef<HTMLButtonElement>(null)
  const primerExtra = useRef<HTMLAnchorElement>(null)
  const mes = crearMesAgenda(new Date(), offsetMes)
  const puntos = puntosAgenda(items)
  const fechaSeleccionada = seleccion ?? mes.fechaHoy
  useEffect(() => { if (open) accionVista.current?.focus() }, [open, vista])
  useEffect(() => { if (mostrarTodos) primerExtra.current?.focus() }, [mostrarTodos])
  return <div className="relative">
    <button type="button" className="ui-button ui-button-ghost ui-button-icon relative" aria-label="Agenda de hoy"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => {
        if (!open) { setVista('calendario'); setOffsetMes(0); setSeleccion(null); setMostrarTodos(false) }
        onToggle()
      }}>
      <CalendarDays className="size-5" aria-hidden="true" />
      {!error && items.length > 0 && <span aria-hidden="true" className="absolute right-0 top-0 size-1.5 rounded-full bg-red-500" />}
    </button>
    {open && <section id={id} role="dialog" aria-label="Agenda de hoy"
      className="fixed right-3 top-16 z-50 flex max-h-[calc(100dvh-5rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-xl border border-qms-border bg-qms-surface shadow-lg sm:absolute sm:right-0 sm:top-full sm:mt-2">
      <h2 className="sr-only">Agenda de hoy</h2>
      {vista === 'agenda' && <div className="flex h-12 shrink-0 items-center justify-between px-3 text-sm font-semibold text-qms-dark">
        <button ref={accionVista} type="button" onClick={() => setVista('calendario')}
          className="flex items-center gap-1 text-sm text-qms-primary">
          <ChevronLeft className="size-5" aria-hidden="true" />Volver al calendario
        </button>
      </div>}
      <div className={`min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 ${vista === 'agenda' ? 'max-h-80' : ''}`} aria-busy={!!loading}>
        {vista === 'calendario' ? <div data-agenda-calendar>
          <div className="flex justify-between items-center mb-4 px-2 pt-2">
            <h3 className="text-sm font-semibold text-gray-800 capitalize" aria-live="polite">{mes.titulo.replace(' de ', ' ')}</h3>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Mes anterior" title="Mes anterior" onClick={() => setOffsetMes(valor => valor - 1)}
                className="flex w-8 h-8 items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"><ChevronLeft className="w-5 h-5" aria-hidden="true" /></button>
              <button type="button" aria-label="Mes siguiente" title="Mes siguiente" onClick={() => setOffsetMes(valor => valor + 1)}
                className="flex w-8 h-8 items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"><ChevronRight className="w-5 h-5" aria-hidden="true" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2 text-center" aria-hidden="true">
            {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(dia => <div key={dia} className="text-xs font-medium text-gray-400">{dia}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-4" role="group" aria-label={`Calendario de ${mes.titulo}`}>
            {mes.semanas.flat().map((dia, indice) => {
              if (!dia) return <span key={indice} aria-hidden="true" className="w-8 h-8" />
              const fecha = mes.prefijo + String(dia).padStart(2, '0')
              const motivo = !error ? puntos.get(fecha) : undefined
              return <button key={fecha} type="button" aria-label={`${dia} ${mes.titulo}${motivo ? ', con pendientes' : ''}`}
                  aria-current={dia === mes.hoy ? 'date' : undefined} aria-pressed={fecha === fechaSeleccionada}
                  onClick={() => setSeleccion(fecha)}
                  className={fecha === fechaSeleccionada
                    ? 'relative w-8 h-8 mx-auto flex items-center justify-center rounded-full bg-qms-primary text-white font-bold shadow-sm'
                    : 'relative w-8 h-8 mx-auto flex items-center justify-center text-gray-700 rounded-full hover:bg-gray-100 transition-colors'}>{dia}
                {motivo && <span aria-hidden="true" className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${MOTIVOS_AGENDA[motivo].punto}`} />}
              </button>
            })}
          </div>
          <div className="-mx-2 -mb-2 flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3">
            <p className="flex items-center gap-2 text-xs text-gray-700" role="status">{loading ? 'Cargando tareas…'
              : error ? 'No se pudieron cargar los pendientes.'
              : <><CheckCircle className="size-4 shrink-0 text-qms-primary" aria-hidden="true" />
                <span><span className="font-medium text-qms-dark">{items.length} {items.length === 1 ? 'tarea' : 'tareas'}</span> hoy</span></>}</p>
            <button ref={accionVista} type="button" onClick={() => setVista('agenda')}
              className="shrink-0 text-xs font-medium text-qms-primary hover:text-qms-primary-hover hover:underline">Ver agenda</button>
          </div>
        </div> : loading ? <p role="status" className="p-3 text-sm text-qms-muted">Cargando agenda…</p>
          : error ? <div role="alert" className="p-3 text-sm text-qms-muted">No se pudo cargar la agenda.
            <button type="button" onClick={onRetry} className="ml-2 text-qms-primary underline">Reintentar</button></div>
          : !items.length ? <p className="p-3 text-sm text-qms-muted">No hay tareas urgentes para hoy.</p>
          : <><ul className="space-y-1">{items.slice(0, mostrarTodos ? items.length : 5).map((item, indice) => <li key={`${item.ruta}:${item.id}`}>
            <Link ref={indice === 5 ? primerExtra : undefined} href={item.ruta} prefetch={false} onClick={onClose}
              className="block min-w-0 rounded-card border border-qms-border/50 p-3 hover:bg-slate-50 focus-visible:bg-slate-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 max-w-full truncate text-sm font-semibold text-qms-dark">{item.codigo}</span>
                <Badge variant={MOTIVOS_AGENDA[item.motivo].variant}>{MOTIVOS_AGENDA[item.motivo].label}</Badge>
              </div>
              <p className="mt-1 truncate text-sm text-qms-muted" title={item.descripcion}>{item.descripcion || 'Sin descripción'}</p>
            </Link>
          </li>)}</ul>
          {!mostrarTodos && items.length > 5 && <button type="button" onClick={() => setMostrarTodos(true)}
            className="block w-full py-3 text-center text-sm text-blue-600 hover:text-blue-700 hover:underline">Ver más</button>}
          </>}
      </div>
    </section>}
  </div>
}
