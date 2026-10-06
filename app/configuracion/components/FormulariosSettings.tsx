'use client'

import { useState } from 'react'
import { Copy, Plus, ExternalLink } from 'lucide-react'
import { useFormulariosPublicos, useCrearFormularioPublico, useToggleFormularioPublico, useEliminarFormularioPublico, type FormularioPublico } from '@/lib/queries/useFormulariosPublicos'
import { useAuthStore } from '@/lib/store/auth-store'
import { showError, showSuccess } from '@/lib/services/errorToast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'
import Badge from '@/components/ui/Badge'
import ErrorState from '@/components/ui/ErrorState'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/usuarios/ConfirmDialog'

export default function FormulariosSettings({ active }: { active: boolean }) {
  const user = useAuthStore(state => state.user)
  const query = useFormulariosPublicos(active)
  const crear = useCrearFormularioPublico()
  const toggle = useToggleFormularioPublico()
  const borrar = useEliminarFormularioPublico()
  const [nuevo, setNuevo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [eliminar, setEliminar] = useState<FormularioPublico | null>(null)
  const urlDe = (token: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${token}`

  const copiar = async (token: string) => {
    try {
      await navigator.clipboard.writeText(urlDe(token))
      showSuccess('Enlace copiado')
    } catch { showError(new Error('No se pudo copiar el enlace'), 'Usá el botón Abrir para acceder al formulario') }
  }

  if (query.isPending) return <p role="status" className="p-6 text-sm text-qms-muted">Cargando formularios…</p>
  if (query.error) return <ErrorState onRetry={() => void query.refetch()} />

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-qms-muted">Compartí estos enlaces para recibir quejas sin iniciar sesión. Desactivar un enlace impide nuevos envíos; las quejas existentes se conservan.</p><Button onClick={() => setNuevo(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Crear enlace</Button></div>
    <div className="ui-panel overflow-x-auto"><table className="ui-table">
      <caption className="sr-only">Enlaces públicos para recibir quejas</caption>
      <thead><tr><th scope="col">Nombre</th><th scope="col">Estado</th><th scope="col">Creado</th><th scope="col">Enlace y acciones</th></tr></thead>
      <tbody>{query.data?.length ? query.data.map(formulario => <tr key={formulario.id}>
        <td className="font-medium">{formulario.nombre}</td><td><Badge variant={formulario.activo ? 'green' : 'gray'}>{formulario.activo ? 'Activo' : 'Inactivo'}</Badge></td><td className="whitespace-nowrap text-qms-muted">{new Date(formulario.created_at).toLocaleDateString('es-CR')}</td>
        <td><div className="flex flex-wrap gap-1">
          <Button size="sm" variant="link" onClick={() => void copiar(formulario.token)} aria-label={`Copiar enlace de ${formulario.nombre}`}><Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copiar</Button>
          <a className="ui-button ui-button-link ui-button-sm" href={urlDe(formulario.token)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${formulario.nombre}`}><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Abrir</a>
          <Button size="sm" variant="secondary" disabled={toggle.isPending || borrar.isPending} onClick={async () => { try { await toggle.mutateAsync({ id: formulario.id, activo: !formulario.activo }); showSuccess(formulario.activo ? 'Enlace desactivado' : 'Enlace activado') } catch (error) { showError(error as Error, 'No se pudo cambiar el estado') } }}>{formulario.activo ? 'Desactivar' : 'Activar'}</Button>
          <Button size="sm" variant="danger" disabled={borrar.isPending || toggle.isPending} onClick={() => setEliminar(formulario)} aria-label={`Eliminar enlace de ${formulario.nombre}`}>Eliminar</Button>
        </div></td>
      </tr>) : <tr><td colSpan={4} className="py-10! text-center text-qms-muted">No hay enlaces públicos. Creá uno para empezar a recibir quejas.</td></tr>}</tbody>
    </table></div>
    <Modal open={nuevo} onClose={() => { if (!crear.isPending) setNuevo(false) }} title="Crear enlace público" size="sm">
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault()
        if (crear.isPending || !nombre.trim()) return
        try { await crear.mutateAsync({ nombre: nombre.trim(), creadoPor: user?.id ?? null }); setNuevo(false); setNombre(''); showSuccess('Enlace creado. Usá Copiar para compartirlo.') }
        catch (error) { showError(error as Error, 'No se pudo crear el enlace') }
      }}>
        <Field id="formulario-nombre" label="Nombre del enlace" hint="Elegí un nombre que te permita reconocer dónde se comparte."><Input id="formulario-nombre" aria-describedby="formulario-nombre-hint" required disabled={crear.isPending} value={nombre} onChange={event => setNombre(event.target.value)} placeholder="Ej.: Quejas desde el sitio web" /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" disabled={crear.isPending} onClick={() => setNuevo(false)}>Cancelar</Button><Button type="submit" loading={crear.isPending} disabled={!nombre.trim()}>Crear enlace</Button></div>
      </form>
    </Modal>
    <ConfirmDialog open={!!eliminar} title="Eliminar enlace público" message={<>Se eliminará «{eliminar?.nombre}». Las quejas ya enviadas se conservan.</>} confirmLabel="Eliminar enlace" danger loading={borrar.isPending} onCancel={() => setEliminar(null)} onConfirm={async () => {
      if (!eliminar || borrar.isPending) return
      try { await borrar.mutateAsync(eliminar.id); setEliminar(null); showSuccess('Enlace eliminado') }
      catch (error) { showError(error as Error, 'No se pudo eliminar el enlace') }
    }} />
  </div>
}
