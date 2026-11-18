'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { IDENTIDAD_ACCEPT, IDENTIDAD_IMAGENES, IDENTIDAD_MAX_BYTES, IDENTIDAD_STORED_BYTES, type ImagenIdentidad } from '@/lib/constants/identidad'
import { identidadImagenesKey, guardarImagenIdentidad, quitarImagenIdentidad } from '@/lib/queries/useIdentidadImagenes'
import LogoRecorteModal, { type BorradorLogo } from './LogoRecorteModal'

export default function ImagenIdentidadEditor({ slot, url }: { slot: ImagenIdentidad; url: string }) {
  const meta = IDENTIDAD_IMAGENES[slot]
  const client = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [borrador, setBorrador] = useState<BorradorLogo | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const temporal = borrador?.url
    return () => { if (temporal) URL.revokeObjectURL(temporal) }
  }, [borrador])

  const elegir = (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!archivo) return
    if (!IDENTIDAD_ACCEPT.split(',').includes(archivo.type) || archivo.size === 0 || archivo.size > IDENTIDAD_MAX_BYTES) {
      setError('Elegí una imagen PNG, JPG o WebP de hasta 4 MB.')
      return
    }
    setError('')
    setBorrador({ archivo, url: URL.createObjectURL(archivo) })
  }

  const guardar = async (imagen: Blob) => {
    if (guardando || quitando) return
    if (imagen.size > IDENTIDAD_STORED_BYTES) { setError('La imagen generada supera 2 MB. Elegí otra foto.'); return }
    setGuardando(true)
    try {
      await guardarImagenIdentidad(slot, imagen)
      setBorrador(null)
      await client.invalidateQueries({ queryKey: identidadImagenesKey })
      showSuccess('Imagen institucional actualizada')
    } catch (reason) { showError(reason, 'No se pudo actualizar la imagen') }
    finally { setGuardando(false) }
  }

  const quitar = async () => {
    if (quitando || guardando) return
    setQuitando(true)
    try {
      await quitarImagenIdentidad(slot)
      await client.invalidateQueries({ queryKey: identidadImagenesKey })
      showSuccess('Imagen quitada')
    } catch (reason) { showError(reason, 'No se pudo quitar la imagen') }
    finally { setQuitando(false) }
  }

  return <section className="ui-panel overflow-hidden" aria-label={meta.titulo}>
    <div className="border-b border-qms-border bg-qms-table-head px-5 py-3">
      <h3 className="text-sm font-semibold">{meta.titulo}</h3>
    </div>
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex w-full shrink-0 items-center justify-center overflow-hidden rounded-card border border-qms-border bg-qms-panel-soft sm:w-52"
        style={{ aspectRatio: String(meta.proporcion) }}>
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={meta.titulo} className="h-full w-full object-cover" />
        ) : <ImagePlus className="h-7 w-7 text-qms-muted" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-qms-muted">{meta.descripcion}</p>
        <p className="mt-1 text-xs text-qms-muted">Formato PNG, JPG o WebP. Recortá y centrà la imagen antes de guardar; máximo 4 MB de origen.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={guardando || quitando} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> {url ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          {url && <Button size="sm" variant="danger" disabled={guardando} loading={quitando} onClick={() => void quitar()}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Quitar imagen
          </Button>}
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-qms-danger">{error}</p>}
        <input ref={inputRef} type="file" accept={IDENTIDAD_ACCEPT} className="sr-only"
          aria-label={`Seleccionar ${meta.titulo.toLowerCase()}`} onChange={elegir} />
      </div>
    </div>
    {borrador && <LogoRecorteModal key={borrador.url} borrador={borrador} guardando={guardando}
      aspectRatio={meta.proporcion} outputWidth={meta.ancho} nombre={meta.titulo.toLowerCase()}
      onCerrar={() => setBorrador(null)} onGuardar={(imagen) => { void guardar(imagen) }} />}
  </section>
}
