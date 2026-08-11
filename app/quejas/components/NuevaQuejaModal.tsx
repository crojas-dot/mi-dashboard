'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { generarFolio } from '@/lib/services/folioService'
import { showError, showSuccess } from '@/lib/services/errorToast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  categorias: { valor: string; color: string }[]
  estados: { valor: string; color: string }[]
  prioridades: { valor: string; color: string }[]
}

export default function NuevaQuejaModal({ open, onClose, onCreated, categorias, estados, prioridades }: Props) {
  const [form, setForm] = useState({ cliente_nombre: '', email_cliente: '', categoria: '', descripcion: '', prioridad: prioridades[0]?.valor ?? '', estado: estados[0]?.valor ?? '' })

  useEffect(() => {
    if (open) setForm({ cliente_nombre: '', email_cliente: '', categoria: '', descripcion: '', prioridad: prioridades[0]?.valor ?? '', estado: estados[0]?.valor ?? '' })
  }, [open])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const folio = await generarFolio('queja')
      const { error } = await supabase.from('quejas').insert([{
        folio,
        cliente_nombre: form.cliente_nombre,
        email_cliente: form.email_cliente,
        categoria: form.categoria,
        descripcion: form.descripcion,
        prioridad: form.prioridad,
        estado: form.estado,
        fecha: new Date().toISOString(),
      }])
      if (error) { showError(error, 'No se pudo crear la queja'); return }
      showSuccess('Queja creada correctamente')
      setForm({ cliente_nombre: '', email_cliente: '', categoria: '', descripcion: '', prioridad: prioridades[0]?.valor ?? '', estado: estados[0]?.valor ?? '' })
      onCreated()
      onClose()
    } catch (err) {
      showError(err as Error, 'No se pudo crear la queja')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Queja">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
          <input required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.cliente_nombre} onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input type="email" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.email_cliente} onChange={(e) => setForm({ ...form, email_cliente: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
          {categorias.length > 0 ? (
            <Select required className="w-full" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              <option value="">Seleccionar categoría</option>
              {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.valor}</option>)}
            </Select>
          ) : (
            <input required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Escribir categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
          {estados.length > 0 ? (
            <Select className="w-full" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {estados.map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
            </Select>
          ) : (
            <input required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Escribir estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Prioridad</label>
          {prioridades.length > 0 ? (
            <Select className="w-full" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
              {prioridades.map((p) => <option key={p.valor} value={p.valor}>{p.valor}</option>)}
            </Select>
          ) : (
            <input required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Escribir prioridad" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
          <textarea rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}
