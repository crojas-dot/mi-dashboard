'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EntityRequestScope } from '@/hooks/useEntityRequestGuard'
import { quejaActividadKey, useCrearQuejaActividad, type QuejaActividad } from '@/lib/queries/useQuejaActividad'
import { actualizarNotaInvestigacion, eliminarNotaInvestigacion } from '@/lib/services/quejaInvestigacionService'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { esNotaInvestigacion } from '@/lib/utils/quejaInvestigacionNotas'

const MAX_NOTA = 10_000

export function useQuejaNotas({ id, usuario, scope, puedeAgregar, puedeEditar }: {
  id: string
  usuario?: string
  scope: EntityRequestScope
  puedeAgregar: boolean
  puedeEditar: boolean
}) {
  const queryClient = useQueryClient()
  const crear = useCrearQuejaActividad()
  const version = useRef(0)
  const [previous, setPrevious] = useState(id)
  const [nota, setNota] = useState('')
  const [editando, setEditando] = useState<QuejaActividad | null>(null)
  const [edicion, setEdicion] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [operating, setOperating] = useState(false)
  if (previous !== id) {
    setPrevious(id); setNota(''); setEditando(null); setEdicion('')
    setMenuId(null); setDeletingId(null); setSaving(false); setOperating(false)
  }
  const puedeModificar = (item: QuejaActividad) =>
    puedeEditar && !!usuario && item.usuario_id === usuario && item.queja_id === id && esNotaInvestigacion(item)

  async function onAdd() {
    const descripcion = nota.trim()
    if (!puedeAgregar || !id || !usuario || !descripcion) return
    if (descripcion.length > MAX_NOTA || !esNotaInvestigacion({ tipo: 'nota', descripcion })) {
      showError(null, 'Revisá la nota. Admite hasta 10.000 caracteres.')
      return
    }
    const operation = scope.start('activity-note')
    if (!operation) return
    const sentVersion = version.current
    setSaving(true)
    try {
      await crear.mutateAsync({ quejaId: id, descripcion, usuarioId: usuario, isContextCurrent: scope.captureContext() })
      if (operation.isCurrent()) {
        if (sentVersion === version.current) setNota('')
        showSuccess('Nota agregada a la actividad')
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, 'No se pudo agregar la nota')
    } finally {
      if (operation.isCurrent()) setSaving(false)
      operation.finish()
    }
  }

  async function mutar(item: QuejaActividad, borrar: boolean) {
    if (!puedeModificar(item)) return
    const operation = scope.start('investigation-note')
    if (!operation) return
    const isContextCurrent = scope.captureContext()
    setOperating(true)
    try {
      if (borrar) await eliminarNotaInvestigacion(item)
      else await actualizarNotaInvestigacion(item, edicion)
      if (isContextCurrent()) void queryClient.invalidateQueries({ queryKey: quejaActividadKey(id) })
      if (operation.isCurrent()) {
        setEditando(null); setEdicion(''); setMenuId(null); setDeletingId(null)
        showSuccess(borrar ? 'Nota eliminada' : 'Nota actualizada')
      }
    } catch (error) {
      if (operation.isCurrent()) showError(error, borrar ? 'No se pudo eliminar la nota' : 'No se pudo actualizar la nota')
    } finally {
      if (operation.isCurrent()) setOperating(false)
      operation.finish()
    }
  }

  return {
    pending: saving || operating,
    dirty: !!nota.trim() || !!editando,
    closeMenu: () => { setMenuId(null); setDeletingId(null) },
    campos: {
      canEdit: puedeAgregar, nota, maxLength: MAX_NOTA, saving, operating, onAdd, puedeModificar,
      menuId, editingId: editando?.id ?? null, editValue: edicion, deletingId,
      onChange: (value: string) => { version.current++; setNota(value) },
      onToggleMenu: (noteId: string) => { setMenuId(current => current === noteId ? null : noteId); setDeletingId(null) },
      onEdit: (item: QuejaActividad) => { setMenuId(null); setDeletingId(null); setEditando(item); setEdicion(item.descripcion) },
      onEditChange: setEdicion,
      onCancelEdit: () => { setEditando(null); setEdicion('') },
      onSaveEdit: () => editando && mutar(editando, false),
      onRequestDelete: setDeletingId,
      onCancelDelete: () => setDeletingId(null),
      onConfirmDelete: (item: QuejaActividad) => mutar(item, true),
    },
  }
}
