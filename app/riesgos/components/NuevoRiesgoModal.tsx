'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { nivelRiesgoVariant } from '@/lib/constants/estados'
import { calcularNivelRiesgo } from '@/lib/utils/riesgos'
import Select from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { generarFolio } from '@/lib/services/folioService'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { getUserError } from '@/lib/errors/userError'
import { logger } from '@/lib/utils/logger'
import { trimTextFields, requireOption, validateRiskScale, requireText } from '@/lib/utils/operationalFormValidation'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}


export default function NuevoRiesgoModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ folio: '', tipo: 'Riesgo Operativo', categoria: '', descripcion: '', causa: '', efecto: '', probabilidad: 1, impacto: 1, accion_mitigacion: '' })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const submitting = useRef(false)

  const handleClose = () => {
    if (!submitting.current) onClose()
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setErrorMessage('')
    let saved = false
    try {
      const values = trimTextFields(form)
      requireOption(values.tipo, ['Riesgo Operativo', 'Riesgo Estratégico', 'Riesgo de Cumplimiento'], 'Tipo')
      validateRiskScale(values.probabilidad, 'Probabilidad')
      validateRiskScale(values.impacto, 'Impacto')
      const folio = values.folio || await generarFolio('riesgo')
      requireText(folio, 'Folio')
      const { error } = await supabase.from('riesgos').insert([{
        folio,
        tipo: values.tipo,
        categoria: values.categoria,
        descripcion: values.descripcion,
        causa: values.causa,
        efecto: values.efecto,
        probabilidad: values.probabilidad,
        impacto: values.impacto,
        nivel: calcularNivelRiesgo(values.probabilidad, values.impacto),
        estado: 'Activo',
        accion_mitigacion: values.accion_mitigacion,
        fecha_identificacion: new Date().toISOString(),
      }])
      if (error) throw error
      saved = true
      setForm({ folio: '', tipo: 'Riesgo Operativo', categoria: '', descripcion: '', causa: '', efecto: '', probabilidad: 1, impacto: 1, accion_mitigacion: '' })
      onCreated()
      onClose()
      showSuccess('Riesgo creado correctamente')
    } catch (error) {
      const message = saved
        ? 'El registro ya se guardó, pero no se pudo actualizar la vista. Recarga el listado.'
        : getUserError(error, 'No se pudo crear el riesgo').message
      setErrorMessage(message)
      logger.error(saved ? 'No se pudo actualizar la vista tras el alta' : 'No se pudo crear el riesgo',
        { module: 'riesgos', action: saved ? 'refresh_after_create' : 'create' }, error)
      showError(saved ? new Error(message) : error, 'No se pudo crear el riesgo')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo Riesgo" size="lg">
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-qms-danger">{errorMessage}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nuevo-riesgo-folio" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Folio</label>
            <input id="nuevo-riesgo-folio" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} placeholder="Auto-generado" />
          </div>
          <div>
            <label htmlFor="nuevo-riesgo-tipo" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
            <Select id="nuevo-riesgo-tipo" className="w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Riesgo Operativo</option>
              <option>Riesgo Estratégico</option>
              <option>Riesgo de Cumplimiento</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nuevo-riesgo-categoria" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
            <input id="nuevo-riesgo-categoria" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          </div>
        </div>
        <div>
          <label htmlFor="nuevo-riesgo-descripcion" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
          <textarea id="nuevo-riesgo-descripcion" rows={2} className="ui-textarea w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nuevo-riesgo-causa" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Causa</label>
            <input id="nuevo-riesgo-causa" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.causa} onChange={(e) => setForm({ ...form, causa: e.target.value })} />
          </div>
          <div>
            <label htmlFor="nuevo-riesgo-efecto" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Efecto</label>
            <input id="nuevo-riesgo-efecto" className="ui-field w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.efecto} onChange={(e) => setForm({ ...form, efecto: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nuevo-riesgo-probabilidad" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Probabilidad</label>
            <Select id="nuevo-riesgo-probabilidad" className="w-full" value={form.probabilidad} onChange={(e) => setForm({ ...form, probabilidad: Number(e.target.value) })}>
              <option value={1}>1 - Baja</option>
              <option value={2}>2 - Media</option>
              <option value={3}>3 - Alta</option>
            </Select>
          </div>
          <div>
            <label htmlFor="nuevo-riesgo-impacto" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Impacto</label>
            <Select id="nuevo-riesgo-impacto" className="w-full" value={form.impacto} onChange={(e) => setForm({ ...form, impacto: Number(e.target.value) })}>
              <option value={1}>1 - Bajo</option>
              <option value={2}>2 - Medio</option>
              <option value={3}>3 - Alto</option>
            </Select>
          </div>
        </div>
        <div>
          <label htmlFor="nuevo-riesgo-accion-de-mitigacion" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Acción de Mitigación</label>
          <textarea id="nuevo-riesgo-accion-de-mitigacion" rows={2} className="ui-textarea w-full px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.accion_mitigacion} onChange={(e) => setForm({ ...form, accion_mitigacion: e.target.value })} />
        </div>
        <p className="text-sm text-gray-500">
          Nivel calculado: <Badge variant={nivelRiesgoVariant[calcularNivelRiesgo(form.probabilidad, form.impacto)] || 'gray'}>{calcularNivelRiesgo(form.probabilidad, form.impacto)}</Badge>
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={handleClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Crear</Button>
        </div>
      </form>
    </Modal>
  )
}
