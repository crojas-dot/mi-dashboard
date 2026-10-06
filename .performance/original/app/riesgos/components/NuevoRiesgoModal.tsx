'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { generarFolio } from '@/lib/services/folioService'
import { showError, showSuccess } from '@/lib/services/errorToast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const nivelColor: Record<string, string> = { Bajo: 'green', Medio: 'amber', Alto: 'red', Critico: 'red' }

export default function NuevoRiesgoModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ folio: '', tipo: 'Riesgo Operativo', categoria: '', descripcion: '', causa: '', efecto: '', probabilidad: 1, impacto: 1, accion_mitigacion: '' })
  const [loading, setLoading] = useState(false)

  const calcularNivel = (p: number, i: number): string => {
    const m = p * i
    if (m <= 2) return 'Bajo'
    if (m <= 4) return 'Medio'
    if (m <= 6) return 'Alto'
    return 'Critico'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const nivel = calcularNivel(form.probabilidad, form.impacto)
      const folio = form.folio || await generarFolio('riesgo')
      const { error } = await supabase.from('riesgos').insert([{
        folio,
        tipo: form.tipo,
        categoria: form.categoria,
        descripcion: form.descripcion,
        causa: form.causa,
        efecto: form.efecto,
        probabilidad: form.probabilidad,
        impacto: form.impacto,
        nivel,
        estado: 'Activo',
        accion_mitigacion: form.accion_mitigacion,
        fecha_identificacion: new Date().toISOString(),
      }])
      if (error) { showError(error, 'No se pudo crear el riesgo'); return }
      showSuccess('Riesgo creado correctamente')
      setForm({ folio: '', tipo: 'Riesgo Operativo', categoria: '', descripcion: '', causa: '', efecto: '', probabilidad: 1, impacto: 1, accion_mitigacion: '' })
      onCreated()
      onClose()
    } catch (err) {
      showError(err as Error, 'No se pudo crear el riesgo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Riesgo" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Folio</label>
            <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} placeholder="Auto-generado" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
            <Select className="w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Riesgo Operativo</option>
              <option>Riesgo Estratégico</option>
              <option>Riesgo de Cumplimiento</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
            <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
          <textarea rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Causa</label>
            <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.causa} onChange={(e) => setForm({ ...form, causa: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Efecto</label>
            <input className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.efecto} onChange={(e) => setForm({ ...form, efecto: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Probabilidad</label>
            <Select className="w-full" value={form.probabilidad} onChange={(e) => setForm({ ...form, probabilidad: Number(e.target.value) })}>
              <option value={1}>1 - Baja</option>
              <option value={2}>2 - Media</option>
              <option value={3}>3 - Alta</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Impacto</label>
            <Select className="w-full" value={form.impacto} onChange={(e) => setForm({ ...form, impacto: Number(e.target.value) })}>
              <option value={1}>1 - Bajo</option>
              <option value={2}>2 - Medio</option>
              <option value={3}>3 - Alto</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Acción de Mitigación</label>
          <textarea rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.accion_mitigacion} onChange={(e) => setForm({ ...form, accion_mitigacion: e.target.value })} />
        </div>
        <p className="text-sm text-gray-500">
          Nivel calculado: <Badge variant={nivelColor[calcularNivel(form.probabilidad, form.impacto)] || 'gray'}>{calcularNivel(form.probabilidad, form.impacto)}</Badge>
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}
