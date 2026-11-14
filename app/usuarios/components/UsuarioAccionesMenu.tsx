'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { KeyRound, MoreVertical, Pencil, UserRoundCheck, UserRoundX } from 'lucide-react'
import type { Usuario } from '@/lib/queries/useUsuarios'

interface Props {
  usuario: Usuario
  esPropio: boolean
  onEditar: () => void
  onRestablecer: () => void
  onEstado: () => void
}

export default function UsuarioAccionesMenu({ usuario, esPropio, onEditar, onRestablecer, onEstado }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const activo = usuario.estado === 'activo'
  const menuId = 'usuarios-acciones-' + usuario.id

  useEffect(() => {
    if (!open) return
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')
    firstItem?.focus()

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [])
        if (!items.length) return
        event.preventDefault()
        const current = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length
        items[next].focus()
      }
    }
    const closeOnMove = () => setOpen(false)

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', closeOnMove, true)
    window.addEventListener('resize', closeOnMove)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', closeOnMove, true)
      window.removeEventListener('resize', closeOnMove)
    }
  }, [open])

  function toggle() {
    if (open) { setOpen(false); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 224
    const height = 158
    const top = rect.bottom + 6 + height <= window.innerHeight
      ? rect.bottom + 6 : Math.max(8, rect.top - height - 6)
    setPosition({
      top,
      left: Math.min(Math.max(8, rect.right - width), Math.max(8, window.innerWidth - width - 8)),
    })
    setOpen(true)
  }

  function select(action: () => void) {
    setOpen(false)
    action()
  }

  const item = 'flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-qms-dark transition-colors hover:bg-qms-hover-bg focus-visible:bg-qms-hover-bg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40'
  return <>
    <button ref={triggerRef} type="button" onClick={toggle} data-users-action-trigger
      aria-label={`Acciones de ${usuario.nombre}`} title={`Acciones de ${usuario.nombre}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      className={`inline-flex size-9 cursor-pointer items-center justify-center rounded-button text-qms-muted transition-colors hover:bg-qms-hover-bg hover:text-qms-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-qms-primary ${open ? 'bg-qms-hover-bg text-qms-dark' : ''}`}>
      <MoreVertical aria-hidden="true" className="size-[18px]" />
    </button>
    {open && createPortal(
      <div ref={menuRef} id={menuId} data-users-actions-menu role="menu" aria-label={`Acciones de ${usuario.nombre}`}
        style={{ position: 'fixed', top: position.top, left: position.left }}
        className="z-[1000] w-56 overflow-hidden rounded-card border border-qms-border bg-qms-surface py-1 shadow-lg">
        <button type="button" role="menuitem" onClick={() => select(onEditar)} className={item}>
          <Pencil aria-hidden="true" className="size-4 shrink-0 text-qms-muted" />Editar perfil
        </button>
        <button type="button" role="menuitem" onClick={() => select(onRestablecer)} className={item}>
          <KeyRound aria-hidden="true" className="size-4 shrink-0 text-qms-muted" />Restablecer contraseña
        </button>
        <div role="separator" className="my-1 border-t border-qms-border" />
        <button type="button" role="menuitem" disabled={activo && esPropio}
          title={activo && esPropio ? 'No podés desactivar tu propia cuenta' : undefined}
          onClick={() => select(onEstado)}
          className={`${item} ${activo ? 'text-qms-danger hover:bg-red-50' : 'text-qms-success'}`}>
          {activo ? <UserRoundX aria-hidden="true" className="size-4 shrink-0" /> : <UserRoundCheck aria-hidden="true" className="size-4 shrink-0" />}
          {activo ? 'Desactivar cuenta' : 'Restaurar cuenta'}
        </button>
      </div>,
      document.body,
    )}
  </>
}
