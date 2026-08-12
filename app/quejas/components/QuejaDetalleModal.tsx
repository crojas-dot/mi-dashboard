'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import type { Queja } from '@/lib/types'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { useUsuarios, type Usuario } from '@/lib/queries/useUsuarios'
import { useQuejaComentarios, useCrearQuejaComentario } from '@/lib/queries/useQuejaComentarios'
import { actualizarDetallesQueja, derivarQuejaASACP, transicionarQueja } from '@/lib/services/quejaWorkflowService'
import { Send, GitBranch } from 'lucide-react'

interface Props {
  queja: Queja | null
  onClose: () => void
  onUpdated: () => void
  prioridades: { valor: string; color: string }[]
  categorias: { valor: string; color: string }[]
}

const colorMap: Record<string, string> = {
  red: '#dc3545', amber: '#e0a800', green: '#198754',
  blue: '#0d6efd', orange: '#fd7e14', purple: '#6f42c1', gray: '#6c757d',
}

const ESTADOS_FLUJO = ['Recibido', 'No Procede', 'En Investigación', 'Resuelto', 'Finalizado']

const estadoVariant: Record<string, string> = {
  Recibido: 'gray', 'En Investigación': 'amber', Resuelto: 'green',
  'No Procede': 'red', Finalizado: 'gray',
}

export default function QuejaDetalleModal({ queja, onClose, onUpdated, prioridades, categorias }: Props) {
  const [editCategoria, setEditCategoria] = useState('')
  const [editPrioridad, setEditPrioridad] = useState('')
  const [resolucion, setResolucion] = useState('')
  const [notas, setNotas] = useState<string | null>(null)
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

  const handleGuardar = async () => {
    if (!editCategoria && !editPrioridad) return
    setLoading(true)
    try {
      await actualizarDetallesQueja({
        quejaId: queja.id,
        categoria: editCategoria || undefined,
        prioridad: editPrioridad || undefined,
      })
      showSuccess('Datos de la queja actualizados')
      setEditCategoria('')
      setEditPrioridad('')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudieron guardar los cambios')
    } finally {
      setLoading(false)
    }
  }

  const handleTransicion = async (nuevoEstado: string, successMessage: string) => {
    setLoading(true)
    try {
      await transicionarQueja(queja.id, nuevoEstado, resolucion)
      showSuccess(successMessage)
      setResolucion('')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo actualizar el estado de la queja')
    } finally {
      setLoading(false)
    }
  }

  const handleNoProcede = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí el oficio explicativo en Resolución antes de marcar como No Procede')
      return
    }
    await handleTransicion('No Procede', 'Queja marcada como No Procede')
  }

  const handleProcede = async () => {
    await handleTransicion('En Investigación', 'Queja en investigación. Plazo: 15 días.')
  }

  const handleSubirResolucion = async () => {
    if (!resolucion.trim()) {
      showError(null, 'Escribí la resolución antes de marcar la queja como resuelta')
      return
    }
    await handleTransicion('Resuelto', 'Queja resuelta')
  }

  const handleFinalizar = async () => {
    await handleTransicion('Finalizado', 'Queja finalizada')
  }

  const handleGuardarNotas = async () => {
    setLoading(true)
    try {
      await actualizarDetallesQueja({ quejaId: queja.id, notas: notas ?? queja.notas ?? '' })
      showSuccess('Notas guardadas')
      setNotas(null)
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudieron guardar las notas')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardarResponsable = async () => {
    if (!responsableId) return
    setLoading(true)
    try {
      await actualizarDetallesQueja({ quejaId: queja.id, responsableId })
      showSuccess('Responsable asignado')
      setResponsableId('')
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo asignar el responsable')
    } finally {
      setLoading(false)
    }
  }

  const handleDerivarSACP = async () => {
    setDerivando(true)
    try {
      const accion = await derivarQuejaASACP(queja.id)
      showSuccess(`Derivada a SACP como ${accion.folio || 'nueva acción'}`)
      onUpdated()
    } catch (error) {
      showError(error as Error, 'No se pudo derivar a SACP')
    } finally {
      setDerivando(false)
    }
  }

  const handleAgregarComentario = async () => {
    if (!nuevoComentario.trim()) return
    try {
      await crearComentario.mutateAsync({
        quejaId: queja.id,
        comentario: nuevoComentario,
        tipo: comentarioTipo,
        visibleCliente,
      })
      showSuccess('Comentario agregado')
      setNuevoComentario('')
    } catch (error) {
      showError(error as Error, 'No se pudo agregar el comentario')
    }
  }

  const tieneCambios = Boolean(editCategoria || editPrioridad)

  return (
    <Modal open={!!queja} onClose={onClose} title={`Queja ${queja.folio}`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
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
            <Badge variant={estadoVariant[estadoActual] || 'gray'}>{estadoActual}</Badge>
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
          <div className="flex flex-wrap items-center gap-2">
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
              value={notas ?? queja.notas ?? ''}
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="danger" onClick={handleNoProcede} loading={loading}>No procede</Button>
                <Button onClick={handleProcede} loading={loading}>Procede (investigar)</Button>
                <p className="text-xs text-gray-500">Para &quot;No procede&quot; escribí antes el oficio en Resolución.</p>
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
            placeholder="Escribe el oficio o la resolución requerida para la siguiente transición..."
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
            <Button variant="secondary" onClick={() => { setEditCategoria(''); setEditPrioridad('') }}>Cancelar</Button>
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
