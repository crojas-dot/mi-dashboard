'use client'

import {
  MessageSquareWarning, ClipboardList, FileCheck2,
  ShieldAlert, ClipboardCheck, SearchCheck, ChevronRight, ChevronLeft, Check, type LucideIcon,
} from 'lucide-react'
import Modal from '@/components/Modal'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { MODULOS_INFORME, INCLUSIONES_INFORME, type IconoInforme } from './generador/configuracion'
import { useGeneradorInforme } from './generador/useGeneradorInforme'
import VistaPreviaInforme from './generador/VistaPreviaInforme'

interface Props {
  open: boolean
  onClose: () => void
  moduloInicial: string | null
}

const ICONOS_INFORME: Record<IconoInforme, LucideIcon> = {
  quejas: MessageSquareWarning, sacp: ClipboardList, documentos: FileCheck2,
  riesgos: ShieldAlert, auditorias: ClipboardCheck, revision_direccion: SearchCheck,
}
const modulos = MODULOS_INFORME.map(modulo => ({
  ...modulo, icon: ICONOS_INFORME[modulo.iconKey],
}))

// El guard mantiene el hook sin montar cuando el modal está cerrado.
export default function GeneradorInformeModal(props: Props) {
  if (!props.open) return null
  return <ContenidoInforme key={props.moduloInicial ?? 'nuevo'} {...props} />
}

function ContenidoInforme({ open, onClose, moduloInicial }: Props) {
  const {
    paso, setPaso, modulo, setModulo, incluir, setIncluir,
    fechaDesde, setFechaDesde, fechaHasta, setFechaHasta,
    filterEstado, setFilterEstado, filterPrioridad, setFilterPrioridad, filterTipo, setFilterTipo,
    catalogoEstados, catalogoPrioridades, catalogoTipos, resultados, loading, generarInforme,
  } = useGeneradorInforme(moduloInicial)

  return (
    <Modal open={open} onClose={onClose} title="Generar Informe" size="lg">
      <div className="informe-content">
        {paso < 3 && (
          <div className="flex items-center gap-2 mb-4">
            {[1, 2].map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <div
                  className={`flex h-[22px] w-[22px] items-center justify-center rounded-button text-xs font-semibold text-white ${paso >= p ? 'bg-qms-primary' : 'bg-gray-300'}`}
                >
                  {p}
                </div>
                <span className={`text-sm ${paso >= p ? 'text-qms-dark' : 'text-gray-400'}`}>
                  {p === 1 ? 'Selección' : 'Filtros'}
                </span>
                {p < 2 && <span className="mx-1 text-gray-300"><ChevronRight className="inline h-3 w-3" /></span>}
              </div>
            ))}
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-qms-dark">Módulo</p>
              <div className="grid grid-cols-2 gap-2">
                {modulos.map((m) => {
                  const Icon = m.icon
                  const selected = modulo === m.value
                  return (
                    <button
                      key={m.value}
                      onClick={() => setModulo(m.value)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-card border p-3 text-left text-sm transition-all ${selected ? 'border-2 border-qms-primary bg-qms-primary' : 'border-qms-border bg-qms-surface hover:bg-gray-50'}`}
                    >
                      <div
                        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-card ${selected ? 'bg-white/20' : 'bg-soft-blue-bg'}`}
                      >
                        <Icon className={`h-4 w-4 ${selected ? 'text-white' : 'text-qms-primary'}`} />
                      </div>
                      <span className={`font-medium ${selected ? 'text-white' : 'text-qms-dark'}`}>{m.label}</span>
                      {selected && <span className="ml-auto text-xs font-semibold text-white/80"><Check className="inline h-3 w-3" /></span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-qms-dark">¿Qué incluir en el informe?</label>
              <div className="space-y-2">
                {INCLUSIONES_INFORME.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={incluir[item.key as keyof typeof incluir]}
                      onChange={(e) => setIncluir({ ...incluir, [item.key]: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
                <Button onClick={() => { if (modulo) { setPaso(2); setFilterEstado(''); setFilterPrioridad(''); setFilterTipo('') } }}>
                  Siguiente <ChevronRight className="h-4 w-4 inline" />
                </Button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-qms-dark">Desde</label>
                <input
                  type="date"
                  className="ui-field w-full px-3 py-2 text-sm"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-qms-dark">Hasta</label>
                <input
                  type="date"
                  className="ui-field w-full px-3 py-2 text-sm"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            </div>
            {modulo === 'quejas' && catalogoEstados.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-qms-dark">Estado</label>
                <Select className="w-full" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoEstados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'quejas' && catalogoPrioridades.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-qms-dark">Prioridad</label>
                <Select className="w-full" value={filterPrioridad} onChange={(e) => setFilterPrioridad(e.target.value)}>
                  <option value="">Todas</option>
                  {catalogoPrioridades.map((p) => <option key={p.valor} value={p.valor}>{p.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'sacp' && catalogoEstados.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-qms-dark">Estado</label>
                <Select className="w-full" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoEstados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'sacp' && catalogoTipos.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-qms-dark">Tipo</label>
                <Select className="w-full" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoTipos.map((t) => <option key={t.valor} value={t.valor}>{t.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'auditorias' && catalogoEstados.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-qms-dark">Estado</label>
                <Select className="w-full" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoEstados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </Select>
              </div>
            )}
            {modulo === 'documentos' && catalogoEstados.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-qms-dark">Estado</label>
                <Select className="w-full" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogoEstados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={() => setPaso(1)}><ChevronLeft className="h-4 w-4 inline" /> Atrás</Button>
              <Button onClick={generarInforme}>Generar informe <ChevronRight className="h-4 w-4 inline" /></Button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <VistaPreviaInforme
            modulo={modulo} incluir={incluir} fechaDesde={fechaDesde} fechaHasta={fechaHasta}
            resultados={resultados} loading={loading} setPaso={setPaso} onClose={onClose}
          />
        )}
      </div>
    </Modal>
  )
}
