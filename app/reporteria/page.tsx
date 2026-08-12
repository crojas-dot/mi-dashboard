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
      <p className="text-sm mb-4" style={{ color: '#6c757d' }}>
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
              className="flex items-center gap-3 rounded-lg border bg-white p-4 text-left transition-colors hover:bg-gray-50"
              style={{ borderColor: selected ? '#0d6efd' : '#dee2e6', cursor: 'pointer' }}
            >
              <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{ width: '40px', height: '40px', backgroundColor: selected ? '#0d6efd' : '#e7f1ff' }}
              >
                <Icon style={{ width: '20px', height: '20px', color: selected ? '#fff' : '#0d6efd' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold m-0 truncate" style={{ color: '#212529', fontSize: '0.95rem' }}>{m.label}</p>
                <p className="m-0 mt-0.5 text-sm" style={{ color: '#6c757d' }}>Generar informe</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: '#6c757d' }} />
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
