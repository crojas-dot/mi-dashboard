'use client'

import { useState } from 'react'
import {
  MessageSquareWarning, ClipboardList, FileCheck2,
  ShieldAlert, ClipboardCheck, SearchCheck, ChevronRight,
} from 'lucide-react'
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
      <p className="text-sm mb-4" style={{ color: '#6c757d' }}>
        Seleccione un módulo para generar un informe
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map((m) => {
          const Icon = m.icon
          const selected = moduloSeleccionado === m.value
          return (
            <button
              key={m.value}
              onClick={() => { setModuloSeleccionado(m.value); setMostrarGenerador(true) }}
              className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{ width: '40px', height: '40px', backgroundColor: selected ? '#0d6efd' : '#f0f4f8' }}
              >
                <Icon style={{ width: '20px', height: '20px', color: selected ? '#fff' : '#0d6efd' }} />
              </div>
              <div>
                <p className="font-semibold m-0" style={{ color: '#212529', fontSize: '0.95rem' }}>{m.label}</p>
                <p className="m-0 mt-0.5 text-sm" style={{ color: '#0d6efd' }}><ChevronRight className="h-3.5 w-3.5 inline" /> Generar informe</p>
              </div>
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
