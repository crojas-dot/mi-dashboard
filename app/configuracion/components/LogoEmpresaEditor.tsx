'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload } from 'lucide-react'
import Button from '@/components/ui/Button'
import EmpresaLogo from '@/components/EmpresaLogo'
import { showError, showSuccess } from '@/lib/services/errorToast'
import { eliminarLogoEmpresa, guardarLogoEmpresa, logoEmpresaKey, useLogoEmpresa } from '@/lib/queries/useLogoEmpresa'
import { LOGO_MIME, LOGO_ORIGEN_MAX_BYTES, esLogoTipo } from '@/lib/constants/marca'
import LogoRecorteModal, { type BorradorLogo } from './LogoRecorteModal'

const tamanio = (bytes: number) => bytes >= 1024 * 1024
  ? `${Math.round(bytes / (1024 * 1024))} MB`
  : `${Math.round(bytes / 1024)} KB`

/**
 * Marca de la organización para el menú lateral. El archivo elegido solo se
 * sube después de recortarlo: la API recibe el cuadrado ya centrado y valida
 * tipo y peso, así que aquí únicamente se filtran los errores evidentes para
 * no abrir el recorte con un archivo que no se puede guardar.
 */
export default function LogoEmpresaEditor({ active }: { active: boolean }) {
  const consulta = useLogoEmpresa(active)
  const client = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [borrador, setBorrador] = useState<BorradorLogo | null>(null)
  const [errorArchivo, setErrorArchivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const url = consulta.data ?? ''

  // La URL del archivo elegido se libera al cerrar el recorte o al reemplazarlo.
  useEffect(() => {
    const temporal = borrador?.url
    return () => { if (temporal) URL.revokeObjectURL(temporal) }
  }, [borrador])

  const elegir = (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0]
    event.target.value = ''
    if (!archivo) return
    if (!esLogoTipo(archivo.type)) { setErrorArchivo('Formato no admitido. Usá un archivo PNG, JPG o WebP.'); return }
    if (archivo.size > LOGO_ORIGEN_MAX_BYTES) { setErrorArchivo(`La imagen supera ${tamanio(LOGO_ORIGEN_MAX_BYTES)}.`); return }
    setErrorArchivo('')
    setBorrador({ archivo, url: URL.createObjectURL(archivo) })
  }

  const guardar = async (cuadrado: Blob) => {
    if (guardando) return
    setGuardando(true)
    try {
      await guardarLogoEmpresa(cuadrado)
      showSuccess('Logo actualizado')
      setBorrador(null)
      await client.invalidateQueries({ queryKey: logoEmpresaKey })
    } catch (error) { showError(error as Error, 'No se pudo guardar el logo') }
    finally { setGuardando(false) }
  }

  const quitar = async () => {
    if (quitando) return
    setQuitando(true)
    try {
      await eliminarLogoEmpresa()
      showSuccess('Logo eliminado')
      await client.invalidateQueries({ queryKey: logoEmpresaKey })
    } catch (error) { showError(error as Error, 'No se pudo quitar el logo') }
    finally { setQuitando(false) }
  }

  return <section className="ui-panel overflow-hidden" aria-label="Marca de la organización">
    <h3 className="border-b border-qms-border bg-qms-table-head px-5 py-3 text-sm font-semibold">Marca de la organización</h3>
    <div className="flex flex-wrap items-start gap-4 p-5">
      <EmpresaLogo className="h-16 w-16 text-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm text-qms-muted">Logo que aparece en el menú lateral. Se muestra sin fondo ni recorte circular, así que después de elegir la imagen podés centrarla y acercarla en un recuadro; si el archivo tiene transparencia, se conserva.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={quitando || guardando} onClick={() => entrada.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden="true" /> {url ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          {url && <Button size="sm" variant="danger" loading={quitando} disabled={guardando} onClick={() => void quitar()}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Quitar logo
          </Button>}
        </div>
        <p className="text-xs text-qms-muted">PNG, JPG o WebP, hasta {tamanio(LOGO_ORIGEN_MAX_BYTES)}. La imagen se guarda recortada en cuadrado.</p>
        {!!consulta.error && <p role="alert" className="text-sm text-qms-danger">No se pudo leer el logo actual.</p>}
        {errorArchivo && <p role="alert" className="text-sm text-qms-danger">{errorArchivo}</p>}
      </div>
    </div>
    <input ref={entrada} type="file" accept={LOGO_MIME.join(',')} className="sr-only" aria-label="Elegir la imagen del logo" onChange={elegir} />
    {borrador && <LogoRecorteModal
      key={borrador.url}
      borrador={borrador}
      guardando={guardando}
      onCerrar={() => setBorrador(null)}
      onGuardar={(cuadrado) => void guardar(cuadrado)}
    />}
  </section>
}
