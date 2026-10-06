'use client'

import { useState } from 'react'
import {
  MessageSquareWarning, ClipboardList, FileCheck2,
  ShieldAlert, ClipboardCheck, SearchCheck, ChevronRight,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import GeneradorInformeModal from './components/GeneradorInformeModal'

const modulos = [
  { value: 'quejas', label: 'Quejas', icon: MessageSquareWarning },
  { value: 'sacp', label: 'SACP', icon: ClipboardList },
  { value: 'documentos', label: 'Documentos', icon: FileCheck2 },
  { value: 'riesgos', label: 'Riesgos', icon: ShieldAlert },
  { value: 'auditorias', label: 'Auditorías', icon: ClipboardCheck },
  { value: 'revision_direccion', label: 'Revisión por Dirección', icon: SearchCheck },
]

export default function ReporteriaPage() {
  const [moduloSeleccionado, setModuloSeleccionado] = useState<string | null>(null)
  const [mostrarGenerador, setMostrarGenerador] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Reportería" description="Informes imprimibles por módulo" />
      <p className="mb-4 text-sm text-qms-muted">
        Seleccione un módulo para generar un informe
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modulos.map((m) => {
          const Icon = m.icon
          const selected = moduloSeleccionado === m.value
          return (
            <button
              key={m.value}
              onClick={() => { setModuloSeleccionado(m.value); setMostrarGenerador(true) }}
              className={`flex cursor-pointer items-center gap-3 rounded-card border bg-qms-surface p-4 text-left transition-colors hover:bg-gray-50 ${selected ? 'border-qms-primary' : 'border-qms-border'}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-card ${selected ? 'bg-qms-primary' : 'bg-soft-blue-bg'}`}
              >
                <Icon className={`h-5 w-5 ${selected ? 'text-white' : 'text-qms-primary'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="m-0 truncate text-[0.95rem] font-semibold text-qms-dark">{m.label}</p>
                <p className="m-0 mt-0.5 text-sm text-qms-muted">Generar informe</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-qms-muted" />
            </button>
          )
        })}
      </div>

      <GeneradorInformeModal
        open={mostrarGenerador}
        onClose={() => setMostrarGenerador(false)}
        moduloInicial={moduloSeleccionado}
      />
    </div>
  )
}
