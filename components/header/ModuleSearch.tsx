'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Command, Search } from 'lucide-react'
import Modal from '@/components/Modal'
import { MODULOS, GRUPOS_NAVEGACION } from '@/lib/constants/modulos'
import { useAuthStore } from '@/lib/store/auth-store'
import { tienePermiso } from '@/lib/permisos'

export default function ModuleSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore(s => s.user)
  const permisos = useAuthStore(s => s.permisos)

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onShortcut)
    return () => document.removeEventListener('keydown', onShortcut)
  }, [])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  const modules = GRUPOS_NAVEGACION.flatMap(group => group.modulos.map(id => ({
    id,
    group: group.label,
    ...MODULOS[id],
  }))).filter(module => tienePermiso(permisos, module.id, false, user?.rol))
  const matches = modules.filter(module =>
    (module.label + ' ' + module.group).toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))
  )

  const close = () => { setOpen(false); setQuery('') }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Buscar un módulo" title="Buscar módulo (Ctrl+K)"
        className="coreui-search-trigger flex h-10 w-10 shrink-0 items-center gap-2 rounded-md border border-qms-border bg-qms-hover-bg px-2.5 text-qms-muted transition-colors hover:border-qms-primary/40 hover:text-qms-dark sm:w-[200px] lg:w-[250px]">
        <Search aria-hidden="true" className="h-[17px] w-[17px] shrink-0" />
        <span className="hidden min-w-0 flex-1 truncate text-left text-[13px] sm:inline">Buscar un módulo...</span>
        <kbd className="hidden rounded border border-qms-border bg-white px-1.5 py-0.5 text-[11px] font-medium leading-4 text-qms-muted lg:inline">Ctrl K</kbd>
      </button>
      <Modal open={open} onClose={close} title="Ir a un módulo" size="md" height="content">
        <div className="px-4 pb-4 pt-3">
          <label htmlFor="coreui-module-search" className="sr-only">Buscar módulo</label>
          <div className="flex items-center gap-2 rounded-lg border border-qms-border bg-qms-hover-bg px-3">
            <Search className="h-[19px] w-[19px] shrink-0 text-qms-muted" aria-hidden="true" />
            <input id="coreui-module-search" ref={inputRef} autoComplete="off" type="search" value={query}
              placeholder="Quejas, documentos, usuarios..." onChange={event => setQuery(event.target.value)}
              className="h-12 w-full min-w-0 border-0 bg-transparent text-[15px] text-qms-dark outline-none focus:outline-none" />
          </div>
          <p className="mt-4 mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-qms-muted">Módulos disponibles</p>
          <div className="max-h-[min(50dvh,360px)] overflow-y-auto rounded-md border border-qms-border">
            {matches.length === 0 ? <p role="status" className="p-5 text-center text-sm text-qms-muted">No se encontraron módulos.</p>
              : matches.map(module => (
                <Link href={module.ruta} key={module.id} onClick={close}
                  className="flex items-center justify-between gap-2 border-b border-qms-border px-3.5 py-3 text-sm no-underline last:border-b-0 hover:bg-qms-primary-soft">
                  <span className="min-w-0"><span className="block font-semibold text-qms-dark">{module.label}</span><span className="text-xs text-qms-muted">{module.group}</span></span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-qms-muted" aria-hidden="true" />
                </Link>
              ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-qms-muted"><Command className="h-3.5 w-3.5" aria-hidden="true" /> Ctrl + K para buscar rápidamente</div>
        </div>
      </Modal>
    </>
  )
}
