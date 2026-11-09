'use client'

import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Spinner from '@/components/ui/Spinner'
import { LOGO_LADO } from '@/lib/constants/marca'

/** Lado del área visible del recorte, en píxeles CSS. */
const VISTA = 256
const ZOOM_MIN = 1
const ZOOM_MAX = 3
const PASO_TECLA = 4

export interface BorradorLogo { archivo: File; url: string }

/**
 * Recorte cuadrado del logo, con el gesto de una foto de perfil: arrastrar para
 * centrar y acercar para encuadrar. La imagen siempre cubre el recuadro y el
 * desplazamiento se limita a su propio tamaño, así que nunca aparecen bordes
 * vacíos. Al guardar se dibuja el cuadrado visible en un lienzo de LOGO_LADO px:
 * lo que se almacena ya viene centrado y no se reprocesa al mostrarlo. El marco
 * no lleva esquinas redondeadas para que la vista previa coincida con el
 * resultado guardado.
 */
export default function LogoRecorteModal({ borrador, guardando, onCerrar, onGuardar }: {
  borrador: BorradorLogo
  guardando: boolean
  onCerrar: () => void
  onGuardar: (cuadrado: Blob) => void
}) {
  const imagen = useRef<HTMLImageElement>(null)
  const arrastre = useRef<{ id: number; x: number; y: number } | null>(null)
  const [medidas, setMedidas] = useState<{ ancho: number; alto: number } | null>(null)
  const [fallo, setFallo] = useState(false)
  const [zoom, setZoom] = useState(ZOOM_MIN)
  const [posicion, setPosicion] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')

  // Escala que hace que la imagen cubra el círculo sin dejar bordes libres.
  const base = useMemo(() => medidas ? Math.max(VISTA / medidas.ancho, VISTA / medidas.alto) : 1, [medidas])
  const escala = base * zoom
  const anchoPx = (medidas?.ancho ?? 0) * escala
  const altoPx = (medidas?.alto ?? 0) * escala
  const izquierda = (VISTA - anchoPx) / 2 + posicion.x
  const arriba = (VISTA - altoPx) / 2 + posicion.y
  const listo = !!medidas && !guardando && !fallo

  /** El desplazamiento no puede exponer el fondo: se acota a la propia imagen. */
  const ajustar = (valorZoom: number, x: number, y: number) => {
    if (!medidas) return { x, y }
    const escalaNueva = base * valorZoom
    const topeX = Math.max(0, (medidas.ancho * escalaNueva - VISTA) / 2)
    const topeY = Math.max(0, (medidas.alto * escalaNueva - VISTA) / 2)
    return { x: Math.min(topeX, Math.max(-topeX, x)), y: Math.min(topeY, Math.max(-topeY, y)) }
  }

  const mover = (dx: number, dy: number) => setPosicion(actual => ajustar(zoom, actual.x + dx, actual.y + dy))
  const aplicarZoom = (valor: number) => {
    const siguiente = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, valor))
    setZoom(siguiente)
    setPosicion(actual => ajustar(siguiente, actual.x, actual.y))
  }
  const restablecer = () => { setZoom(ZOOM_MIN); setPosicion({ x: 0, y: 0 }) }

  const alPresionar = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !listo) return
    arrastre.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const alArrastrar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activo = arrastre.current
    if (!activo || activo.id !== event.pointerId) return
    mover(event.clientX - activo.x, event.clientY - activo.y)
    arrastre.current = { ...activo, x: event.clientX, y: event.clientY }
  }
  const alSoltar = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (arrastre.current?.id === event.pointerId) arrastre.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const alTeclear = (event: KeyboardEvent<HTMLDivElement>) => {
    const paso = event.shiftKey ? PASO_TECLA * 3 : PASO_TECLA
    if (event.key === 'ArrowLeft') mover(-paso, 0)
    else if (event.key === 'ArrowRight') mover(paso, 0)
    else if (event.key === 'ArrowUp') mover(0, -paso)
    else if (event.key === 'ArrowDown') mover(0, paso)
    else if (event.key === '+' || event.key === '=') aplicarZoom(zoom + 0.1)
    else if (event.key === '-') aplicarZoom(zoom - 0.1)
    else return
    event.preventDefault()
  }

  const confirmar = async () => {
    const origen = imagen.current
    if (!origen || !medidas) return
    setError('')
    const lienzo = document.createElement('canvas')
    lienzo.width = LOGO_LADO
    lienzo.height = LOGO_LADO
    const contexto = lienzo.getContext('2d')
    if (!contexto) { setError('Este navegador no pudo procesar la imagen.'); return }
    const factor = LOGO_LADO / VISTA
    contexto.drawImage(origen, izquierda * factor, arriba * factor, anchoPx * factor, altoPx * factor)
    const codificar = (tipo: string) => new Promise<Blob | null>(resolver => lienzo.toBlob(resolver, tipo, 0.92))
    // WebP ofrece mejor peso con transparencia; PNG solo como respaldo si el
    // navegador no puede codificarlo (no se sube nada que la API rechace).
    const cuadrado = (await codificar('image/webp')) ?? (await codificar('image/png'))
    if (!cuadrado) { setError('No se pudo generar la imagen recortada.'); return }
    onGuardar(cuadrado)
  }

  return <Modal
    open
    onClose={guardando ? () => {} : onCerrar}
    dismissOnEscape={!guardando}
    dismissOnBackdrop={!guardando}
    title="Centrar el logo"
    size="sm"
    footer={<div className="flex justify-end gap-2">
      <Button variant="secondary" disabled={guardando} onClick={onCerrar}>Cancelar</Button>
      <Button loading={guardando} disabled={!listo} onClick={() => void confirmar()}>Guardar logo</Button>
    </div>}
  >
    <div className="space-y-4">
      <p className="text-sm text-qms-muted">Arrastrá la imagen para centrarla. Se guarda tal como se ve en el recuadro, sin fondo.</p>
      <div
        role="application"
        tabIndex={0}
        aria-label="Área de recorte: arrastrá la imagen o usá las flechas para centrarla"
        onPointerDown={alPresionar}
        onPointerMove={alArrastrar}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={alTeclear}
        className={`relative mx-auto touch-none overflow-hidden border border-qms-border bg-qms-hover-bg outline-none focus-visible:ring-2 focus-visible:ring-qms-primary ${listo ? 'cursor-move' : 'cursor-default'}`}
        style={{ width: VISTA, height: VISTA }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imagen}
          src={borrador.url}
          alt=""
          draggable={false}
          onLoad={event => setMedidas({ ancho: event.currentTarget.naturalWidth, alto: event.currentTarget.naturalHeight })}
          onError={() => setFallo(true)}
          className={`pointer-events-none absolute max-w-none select-none ${medidas ? '' : 'invisible'}`}
          style={{ width: anchoPx, height: altoPx, left: izquierda, top: arriba }}
        />
        {!medidas && !fallo && <span className="absolute inset-0 flex items-center justify-center"><Spinner /></span>}
      </div>
      <Field id="logo-zoom" label="Zoom" hint="También podés usar las teclas + y −, y las flechas para mover la imagen.">
        <div className="flex items-center gap-3">
          <input
            id="logo-zoom"
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.05}
            value={zoom}
            disabled={!medidas}
            aria-describedby="logo-zoom-hint"
            onChange={(event: ChangeEvent<HTMLInputElement>) => aplicarZoom(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-qms-primary"
          />
          <Button variant="ghost" size="icon" disabled={!medidas} onClick={restablecer} aria-label="Restablecer el encuadre" title="Restablecer">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </Field>
      {fallo && <p role="alert" className="text-sm text-qms-danger">No se pudo leer la imagen. Elegí otro archivo.</p>}
      {error && <p role="alert" className="text-sm text-qms-danger">{error}</p>}
    </div>
  </Modal>
}
