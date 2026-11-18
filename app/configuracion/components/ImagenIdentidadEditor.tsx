'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { IDENTIDAD_ACCEPT_PICKER, IDENTIDAD_ORIGEN_MAX_BYTES, IDENTIDAD_IMAGENES, IDENTIDAD_MAX_BYTES, type ImagenIdentidad } from '@/lib/constants/identidad'
import { identidadImagenesKey, guardarImagenIdentidad, quitarImagenIdentidad, type ImagenesIdentidad } from '@/lib/queries/useIdentidadImagenes'
import LogoRecorteModal, { type BorradorLogo } from './LogoRecorteModal'

export default function ImagenIdentidadEditor({ slot, url, loading = false }: { slot: ImagenIdentidad; url: string; loading?: boolean }) {
  const meta = IDENTIDAD_IMAGENES[slot]
  const client = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [borrador, setBorrador] = useState<BorradorLogo | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const [error, setError] = useState('')
  const [imagenFallida, setImagenFallida] = useState('')

  useEffect(() => {
    const temporal = borrador?.url
    return () => { if (temporal) URL.revokeObjectURL(temporal) }
  }, [borrador])

  const elegir = (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!archivo) return
    // Se aceptan formatos de imagen que el navegador pueda decodificar.
    // Nunca subir el original: el canvas convierte el recorte a WebP/PNG seguro.
    if (!archivo.type.startsWith('image/') || archivo.type === 'image/svg+xml' ||
      archivo.size === 0 || archivo.size > IDENTIDAD_ORIGEN_MAX_BYTES) {
      setError('Seleccioná una imagen de hasta 30 MB que el navegador pueda abrir. Por seguridad no se admite SVG.')
      return
    }
    setError('')
    setBorrador({ archivo, url: URL.createObjectURL(archivo) })
  }

  const guardar = async (imagen: Blob) => {
    if (guardando || quitando) return
    if (imagen.size > IDENTIDAD_MAX_BYTES) { setError('No se pudo comprimir la imagen antes de subirla.'); return }
    setGuardando(true)
    try {
      const nuevaUrl = await guardarImagenIdentidad(slot, imagen)
      // Mostrar la imagen recién subida inmediatamente, sin depender de una lectura
      // adicional que puede estar en curso o haber quedado en caché.
      client.setQueryData<ImagenesIdentidad>(identidadImagenesKey, prev => ({
        correo_encabezado: '', login_fondo: '', formulario_encabezado: '',
        ...prev, [slot]: nuevaUrl,
      }))
      setImagenFallida('')
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
      client.setQueryData<ImagenesIdentidad>(identidadImagenesKey, prev => ({
        correo_encabezado: '', login_fondo: '', formulario_encabezado: '',
        ...prev, [slot]: '',
      }))
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
        {url && imagenFallida !== url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={meta.titulo} className="h-full w-full object-contain"
            onError={() => setImagenFallida(url)} />
        ) : <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-qms-panel-soft text-qms-muted">
          <ImagePlus className="h-7 w-7" aria-hidden="true" />
          <span className="px-2 text-center text-xs">
            {loading ? 'Cargando vista previa…' : url ? 'No se pudo mostrar la imagen' : 'Sin imagen configurada'}
          </span>
        </div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-qms-muted">{meta.descripcion}</p>
        <div className="mt-2 space-y-1 text-xs leading-relaxed text-qms-muted">
          <p><span className="font-semibold text-qms-dark">Tamaño recomendado:</span> {meta.ancho} × {meta.alto} px. Proporción {meta.proporcion === 1 ? '1:1' : meta.proporcion === 3 ? '3:1' : '16:9'}.</p>
          <p><span className="font-semibold text-qms-dark">Formato y calidad:</span> {meta.recomendacion}</p>
          <p>Las medidas y el formato indicados son sugerencias, no requisitos. Podés elegir cualquier imagen compatible con el navegador, sin exigir el formato sugerido (excepto SVG por seguridad). Máximo técnico de 30 MB de origen; se convierte a {meta.formato.toUpperCase()} y se optimiza a 2 MB para Storage.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={guardando || quitando} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> {url ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          {url && <Button size="sm" variant="danger" disabled={guardando} loading={quitando} onClick={() => void quitar()}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Quitar imagen
          </Button>}
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-qms-danger">{error}</p>}
        <input ref={inputRef} type="file" accept={IDENTIDAD_ACCEPT_PICKER} className="sr-only"
          aria-label={`Seleccionar ${meta.titulo.toLowerCase()}`} onChange={elegir} />
      </div>
    </div>
    {borrador && <LogoRecorteModal key={borrador.url} borrador={borrador} guardando={guardando}
      aspectRatio={meta.proporcion} outputWidth={slot === 'login_fondo' ? IDENTIDAD_IMAGENES.login_fondo.procesamientoAncho : meta.ancho} maxEncodedBytes={IDENTIDAD_MAX_BYTES} nombre={meta.titulo.toLowerCase()}
      onCerrar={() => setBorrador(null)} onGuardar={(imagen) => { void guardar(imagen) }} />}
  </section>
}
