'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import type { Queja } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { generarFolio } from '@/lib/services/folioService'
import { crearNotificacion } from '@/lib/services/notificacionService'
import { useUsuarios, type Usuario } from '@/lib/queries/useUsuarios'
import { useQuejaComentarios, useCrearQuejaComentario } from '@/lib/queries/useQuejaComentarios'
import { useAuthStore } from '@/lib/store/auth-store'
import { Send, GitBranch } from 'lucide-react'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: () => void
  estados: { valor: string; color: string }[]
  prioridades: { valor: string; color: string }[]
  categorias: { valor: string; color: string }[]
}

const colorMap: Record<string, string> = {
  red: '#dc3545', amber: '#fd7e14', green: '#198754',
  blue: '#0d6efd', orange: '#e8590c', purple: '#7c3aed', gray: '#6c757d',
}

const ESTADOS_FLUJO = ['Recibido', 'No Procede', 'En Investigación', 'Resuelto', 'Finalizado']

export default function QuejaDetalleModal({ queja, onClose, onUpdated, estados, prioridades, categorias }: Props) {
  const { user } = useAuthStore()
  const [editEstado, setEditEstado] = useState('')
  const [editCategoria, setEditCategoria] = useState('')
  const [editPrioridad, setEditPrioridad] = useState('')
  const [resolucion, setResolucion] = useState('')
  const [notas, setNotas] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [loading, setLoading] = useState(false)
  const [derivando, setDerivando] = useState(false)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [comentarioTipo, setComentarioTipo] = useState<'interno' | 'cliente'>('interno')
  const [visibleCliente, setVisibleCliente] = useState(false)

  const quejaId = queja?.id ?? ''
  const { data: comentarios = [] } = useQuejaComentarios(quejaId)
  const crearComentario = useCrearQuejaComentario()
  const { data: usuarios = [] } = useUsuarios({ estado: 'activo' })

  const responsables: Usuario[] = (usuarios as Usuario[]).filter((u) => u.rol === 'admin' || u.rol === 'calidad')
  const estadoActual = queja?.estado ?? ''

  if (!queja) return null

  const getColor = (items: { valor: string; color: string }[], valor: string) => {
    const found = items.find((i) => i.valor === valor)
    return found ? colorMap[found.color] || '#6c757d' : '#6c757d'
  }

  const notificarTransicion = (estado: string) => {
    const msgs: Record<string, { tipo: string; mensaje: string }> = {
      'No Procede': { tipo: 'queja_no_procede', mensaje: `La queja ${queja.folio} fue marcada como No Procede.` },
      'En Investigación': { tipo: 'queja_en_investigacion', mensaje: `La queja ${queja.folio} pasó a En Investigación.` },
      Resuelto: { tipo: 'queja_resuelta', mensaje: `La queja ${queja.folio} fue resuelta.` },
      Finalizado: { tipo: 'queja_finalizada', mensaje: `La queja ${queja.folio} fue finalizada.` },
    }
    const m = msgs[estado]
    if (!m || !user?.id) return
    crearNotificacion({
      usuario_id: user.id,
      tipo: m.tipo,
      mensaje: m.mensaje,
      enlace: '/quejas',
      origen_id: queja.id,
    })
  }

  const handleGuardar = async () => {
    const updates: Record<string, unknown> = {}
    if (editEstado) updates.estado = editEstado
    if (editCategoria) updates.categoria = editCategoria
    if (editPrioridad) updates.prioridad = editPrioridad
    if (resolucion) updates.resolucion = resolucion
    if (Object.keys(updates).length === 0) return
    setLoading(true)
    const { error } = await supabase.from('quejas').update(updates).eq('id', queja.id)
    setLoading(false)
    if (error) { showError(error, 'No se pudieron guardar los cambios'); return }
    showSuccess('Queja actualizada')
    setEditEstado(''); setEditCategoria(''); setEditPrioridad(''); setResolucion('')
    onUpdated()
  }

  const handleNoProcede = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí el oficio explicativo en Resolución antes de marcar como No Procede')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('quejas').update({
      estado: 'No Procede',
      resolucion: resolucion.trim(),
      fecha_cierre: new Date().toISOString(),
    }).eq('id', queja.id)
    setLoading(false)
    if (error) { showError(error, 'No se pudo marcar como No Procede'); return }
    showSuccess('Queja marcada como No Procede')
    setResolucion('')
    notificarTransicion('No Procede')
    onUpdated()
  }

  const handleProcede = async () => {
    setLoading(true)
    const fechaLimite = new Date(Date.now() + 15 * 86400000).toISOString()
    const { error } = await supabase.from('quejas').update({
      estado: 'En Investigación',
      fecha_limite_investigacion: fechaLimite,
    }).eq('id', queja.id)
    setLoading(false)
    if (error) { showError(error, 'No se pudo iniciar la investigación'); return }
    showSuccess('Queja en investigación. Plazo: 15 días.')
    notificarTransicion('En Investigación')
    onUpdated()
  }

  const handleSubirResolucion = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí la resolución antes de subirla')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('quejas').update({
      estado: 'Resuelto',
      resolucion: resolucion.trim(),
    }).eq('id', queja.id)
    setLoading(false)
    if (error) { showError(error, 'No se pudo subir la resolución'); return }
    showSuccess('Queja resuelta')
    setResolucion('')
    notificarTransicion('Resuelto')
    onUpdated()
  }

  const handleFinalizar = async () => {
    setLoading(true)
    const updates: Record<string, unknown> = { estado: 'Finalizado' }
    if (!queja.fecha_cierre) updates.fecha_cierre = new Date().toISOString()
    const { error } = await supabase.from('quejas').update(updates).eq('id', queja.id)
    setLoading(false)
    if (error) { showError(error, 'No se pudo finalizar la queja'); return }
    showSuccess('Queja finalizada')
    notificarTransicion('Finalizado')
    onUpdated()
  }

  const handleGuardarNotas = async () => {
    setLoading(true)
    const { error } = await supabase.from('quejas').update({ notas }).eq('id', queja.id)
    setLoading(false)
    if (error) { showError(error, 'No se pudieron guardar las notas'); return }
    showSuccess('Notas guardadas')
    onUpdated()
  }

  const handleGuardarResponsable = async () => {
    if (!responsableId) return
    setLoading(true)
    const { error } = await supabase.from('quejas').update({ responsable_id: responsableId }).eq('id', queja.id)
    setLoading(false)
    if (error) { showError(error, 'No se pudo asignar el responsable'); return }
    showSuccess('Responsable asignado')
    onUpdated()
  }

  const handleDerivarSACP = async () => {
    setDerivando(true)
    try {
      const folio = await generarFolio('sacp')
      const { data: accion, error: insError } = await supabase
        .from('acciones')
        .insert([{
          folio,
          tipo: 'Correctiva',
          origen: 'queja',
          origen_id: queja.id,
          descripcion: queja.descripcion || queja.cliente_nombre,
          estado: 'Abierta',
          seguimiento_porcentaje: 0,
          fecha_apertura: new Date().toISOString(),
        }])
        .select()
        .single()
      if (insError || !accion) {
        showError(insError, 'No se pudo derivar a SACP')
        return
      }
      const { error: updError } = await supabase.from('quejas').update({ derivado_sacp_id: accion.id }).eq('id', queja.id)
      if (updError) { showError(updError, 'Se creó la SACP pero no se pudo vincular la queja'); return }
      showSuccess(`Derivada a SACP como ${folio}`)
      onUpdated()
    } catch (err) {
      showError(err as Error, 'No se pudo derivar a SACP')
    } finally {
      setDerivando(false)
    }
  }

  const handleAgregarComentario = async () => {
    if (!nuevoComentario.trim()) return
    try {
      await crearComentario.mutateAsync({
        quejaId: queja.id,
        usuarioId: user?.id ?? null,
        comentario: nuevoComentario.trim(),
        tipo: comentarioTipo,
        visibleCliente,
      })
      showSuccess('Comentario agregado')
      if (user?.id) {
        crearNotificacion({
          usuario_id: user.id,
          tipo: 'queja_comentario',
          mensaje: `Nuevo comentario en la queja ${queja.folio}.`,
          enlace: '/quejas',
          origen_id: queja.id,
        })
      }
      setNuevoComentario('')
    } catch (e) {
      showError(e as Error, 'No se pudo agregar el comentario')
    }
  }

  const tieneCambios = editEstado || editCategoria || editPrioridad || resolucion

  return (
    <Modal open={!!queja} onClose={onClose} title={`Queja ${queja.folio}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Cliente</p>
            <p className="text-sm font-medium text-gray-900">{queja.cliente_nombre}</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Fecha</p>
            <p className="text-sm text-gray-900">{new Date(queja.fecha).toLocaleString('es-ES')}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Estado</p>
            <Select className="w-full"
              style={{ borderColor: editEstado ? getColor(estados, editEstado) : getColor(estados, queja.estado) }}
              value={editEstado || queja.estado || ''}
              onChange={(e) => setEditEstado(e.target.value)}>
              {estados.filter((e) => ESTADOS_FLUJO.includes(e.valor)).map((e) => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
              {!ESTADOS_FLUJO.includes(queja.estado) && (
                <option value={queja.estado}>{(queja.estado) || ''}</option>
              )}
            </Select>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Prioridad</p>
            <Select className="w-full"
              style={{ borderColor: editPrioridad ? getColor(prioridades, editPrioridad) : getColor(prioridades, queja.prioridad) }}
              value={editPrioridad || queja.prioridad || ''}
              onChange={(e) => setEditPrioridad(e.target.value)}>
              {prioridades.map((p) => <option key={p.valor} value={p.valor}>{p.valor}</option>)}
            </Select>
          </div>

          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Categoría</p>
            {categorias.length > 0 ? (
              <Select className="w-full"
                value={editCategoria || queja.categoria || ''}
                onChange={(e) => setEditCategoria(e.target.value)}>
                <option value="">Seleccionar categoría</option>
                {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.valor}</option>)}
              </Select>
            ) : (
              <input
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={editCategoria || queja.categoria || ''}
                onChange={(e) => setEditCategoria(e.target.value)}
                placeholder="Escribir categoría"
              />
            )}
          </div>

          {queja.fecha_limite_investigacion && (
            <div className="col-span-2">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Fecha límite de investigación</p>
              <p className="text-sm text-gray-900">{new Date(queja.fecha_limite_investigacion).toLocaleDateString('es-ES')}</p>
            </div>
          )}

          {queja.descripcion && (
            <div className="col-span-2">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Descripción</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-200">{queja.descripcion}</p>
            </div>
          )}
        </div>

        {/* Responsable + Notas (Paso 4) */}
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">Responsable y notas</p>
          <div className="flex items-center gap-2">
            <Select className="w-full max-w-xs" value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              <option value="">Sin asignar</option>
              {responsables.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" onClick={handleGuardarResponsable} disabled={!responsableId || responsableId === queja.responsable_id}>Asignar</Button>
          </div>
          {queja.responsable_id && (
            <p className="text-xs text-gray-500">
              Responsable actual: {responsables.find((u) => u.id === queja.responsable_id)?.nombre || '—'}
            </p>
          )}
          <div className="flex items-start gap-2">
            <textarea
              placeholder="Notas internas (no visibles para el quejoso)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={handleGuardarNotas}>Guardar</Button>
          </div>
        </div>

        {/* Máquina de estados (Paso 2) */}
        {ESTADOS_FLUJO.includes(estadoActual) && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">Flujo de atención</p>

            {estadoActual === 'Recibido' && (
              <div className="flex items-center gap-2">
                <Button variant="danger" onClick={handleNoProcede} loading={loading}>No procede</Button>
                <Button onClick={handleProcede} loading={loading}>Procede (investigar)</Button>
                <p className="text-xs text-gray-500">Para "No procede" escribí antes el oficio en Resolución.</p>
              </div>
            )}

            {estadoActual === 'En Investigación' && (
              <div className="flex items-center gap-2">
                <Button onClick={handleSubirResolucion} loading={loading}>Subir resolución</Button>
                {!queja.derivado_sacp_id && (
                  <Button variant="secondary" onClick={handleDerivarSACP} loading={derivando}>
                    <GitBranch className="h-3.5 w-3.5" /> Derivar a SACP
                  </Button>
                )}
                {queja.derivado_sacp_id && <Badge variant="blue">Derivada a SACP</Badge>}
              </div>
            )}

            {estadoActual === 'Resuelto' && (
              <div className="flex items-center gap-2">
                <Button onClick={handleFinalizar} loading={loading}>Finalizar</Button>
                {!queja.derivado_sacp_id && (
                  <Button variant="secondary" onClick={handleDerivarSACP} loading={derivando}>
                    <GitBranch className="h-3.5 w-3.5" /> Derivar a SACP
                  </Button>
                )}
                {queja.derivado_sacp_id && <Badge variant="blue">Derivada a SACP</Badge>}
              </div>
            )}

            {(estadoActual === 'No Procede' || estadoActual === 'Finalizado') && (
              <p className="text-sm text-gray-500">
                {estadoActual === 'No Procede'
                  ? 'Queja cerrada como No Procede.'
                  : 'Queja finalizada.'}
                {queja.fecha_cierre && <> Cierre: {new Date(queja.fecha_cierre).toLocaleDateString('es-ES')}.</>}
              </p>
            )}
          </div>
        )}

        {/* Resolución */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">Resolución / Oficio</p>
          <textarea
            placeholder="Agregar notas sobre el cambio de estado, categoría o prioridad..."
            rows={2}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={resolucion}
            onChange={(e) => setResolucion(e.target.value)}
          />
          {queja.resolucion && (
            <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-200 whitespace-pre-wrap">{queja.resolucion}</p>
          )}
        </div>

        {tieneCambios && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => { setEditEstado(''); setEditCategoria(''); setEditPrioridad(''); setResolucion('') }}>Cancelar</Button>
            <Button onClick={handleGuardar} loading={loading}>Guardar cambios</Button>
          </div>
        )}

        {/* Comentarios (Paso 3) */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">Comentarios</p>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
            {comentarios.length === 0 ? (
              <p className="text-sm text-gray-400">Sin comentarios todavía.</p>
            ) : comentarios.map((c) => (
              <div key={c.id} className="rounded-lg border border-gray-200 p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={c.tipo === 'cliente' ? 'blue' : 'gray'}>{c.tipo === 'cliente' ? 'Cliente' : 'Interno'}</Badge>
                  {c.visible_cliente && <Badge variant="green">Visible al quejoso</Badge>}
                  <span className="text-xs text-gray-400">{new Date(c.fecha).toLocaleString('es-ES')}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comentario}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <textarea
              placeholder="Nuevo comentario..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <Select className="w-full" value={comentarioTipo} onChange={(e) => setComentarioTipo(e.target.value as 'interno' | 'cliente')}>
                <option value="interno">Interno</option>
                <option value="cliente">Cliente</option>
              </Select>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                <input type="checkbox" checked={visibleCliente} onChange={(e) => setVisibleCliente(e.target.checked)} />
                Visible al quejoso
              </label>
              <Button size="sm" onClick={handleAgregarComentario} disabled={!nuevoComentario.trim()}><Send className="h-3 w-3" /> Agregar</Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
