
'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, FileDown, FileText, Save } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/ui/Button'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import QuejaInformeHoja from '@/app/quejas/components/QuejaInformeHoja'
import {
  useQuejaInforme,
  quejaInformeKey,
} from '@/lib/queries/useQuejaInforme'
import { guardarQuejaInforme } from '@/lib/services/quejaInformeService'
import { subirAdjuntoQueja, esOficioPublicableQueja } from '@/lib/services/quejaWorkflowService'
import { fetchQuejaAdjuntos, quejaAdjuntosKey, useQuejaAdjuntos } from '@/lib/queries/useQuejas'
import { errorMsg } from '@/lib/services/errorToast'
import {
  crearPlantillaInforme,
  informeFilename,
  informePdfFilename,
  type QuejaInforme,
} from '@/lib/utils/quejaInforme'
import { useEntityRequestGuard } from '@/hooks/useEntityRequestGuard'
import type { Queja } from '@/lib/types'

interface Props {
  queja: Queja
  anexos: readonly { nombre: string }[]
  autor: string
  onClose: () => void
  onSaved?: (informe: QuejaInforme) => void
}

function InformeIcono() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-card bg-qms-primary-soft text-qms-primary"
    >
      <FileText className="size-5" />
    </span>
  )
}

function ConfirmarSalida({
  onCancel,
  onDiscard,
}: {
  onCancel: () => void
  onDiscard: () => void
}) {
  return (
    <Modal
      open
      onClose={onCancel}
      title="Cambios sin guardar"
      variant="confirmation"
      size="sm"
      dismissOnBackdrop={false}
      descriptionId="queja-informe-unsaved-description"
    >
      <div className="px-6 pb-6 pt-4">
        <p
          id="queja-informe-unsaved-description"
          className="m-0 text-[14px] leading-relaxed text-qms-muted"
        >
          Realizaste cambios en este informe que todavía no se han
          guardado. Si salís ahora, perderás esas modificaciones.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="
              w-full min-w-0
              border border-qms-danger
              bg-white text-qms-danger
              px-2 text-center
              font-medium leading-tight
              hover:!bg-qms-danger
              hover:!border-qms-danger
              hover:!text-white
              transition-colors duration-150
            "
            onClick={onDiscard}
          >
            Salir sin guardar
          </Button>

          <Button
            type="button"
            size="sm"
            autoFocus
            className="w-full min-w-0 whitespace-normal px-2 text-center leading-tight"
            onClick={onCancel}
          >
            Volver al editor
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function QuejaInformeModal(props: Props) {
  const query = useQuejaInforme(props.queja.id)

  const [loaded, setLoaded] = useState<{
    informe: QuejaInforme | null
  } | null>(null)

  if (
    !loaded &&
    !query.isFetching &&
    !query.error &&
    query.data !== undefined
  ) {
    setLoaded({ informe: query.data })
  }

  if (loaded) {
    return (
      <InformeEditor
        key={props.queja.id}
        {...props}
        inicial={loaded.informe}
      />
    )
  }

  const title = `Informe del expediente · ${props.queja.folio}`

  if (query.isLoading || query.isFetching) {
    return (
      <Modal
        open
        onClose={props.onClose}
        title={title}
        headerLeading={<InformeIcono />}
        variant="report"
      >
        <LoadingSkeleton
          variant="list"
          label="Cargando informe del expediente…"
        />
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={props.onClose}
      title={title}
      headerLeading={<InformeIcono />}
      variant="report"
    >
      <div className="p-5">
        <p
          role="alert"
          className="mb-3 text-qms-danger"
        >
          No se pudo cargar el informe guardado.
          Comprobá la conexión antes de generar otra versión.
        </p>

        <Button
          variant="secondary"
          onClick={() => query.refetch()}
        >
          Reintentar
        </Button>
      </div>
    </Modal>
  )
}

function InformeEditor({
  queja,
  anexos,
  autor,
  onClose,
  onSaved,
  inicial,
}: Props & {
  inicial: QuejaInforme | null
}) {
  const [contenido, setContenido] = useState(
    () =>
      inicial?.contenido ??
      crearPlantillaInforme(queja, anexos, autor)
  )

  const [contenidoBase, setContenidoBase] = useState(contenido)
  const initializedRef = useRef(false)
  const [guardado, setGuardado] = useState(inicial)

  const [fuenteRevision] = useState(
    inicial?.fuente_revision ?? queja.revision
  )

  const [guardando, setGuardando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const exportMenuRef = useRef<HTMLDivElement>(null)
  const exportButtonRef = useRef<HTMLButtonElement>(null)

  const scope = useEntityRequestGuard(queja.id)
  const queryClient = useQueryClient()
  const adjuntosQuery = useQuejaAdjuntos(queja.id)
  const pdfNombreActual = guardado ? informePdfFilename(queja.folio, guardado.version) : null
  const pdfExiste = !!pdfNombreActual && !!adjuntosQuery.data?.some(file =>
    file.nombre === pdfNombreActual && file.tipo_mime.toLowerCase() === 'application/pdf'
    && esOficioPublicableQueja(file, queja.id)
  )

  const dirty = contenidoBase !== contenido
  const pending = guardando || exportando || exportandoPdf

  useEffect(() => {
    if (!exportMenuOpen) return

    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !exportMenuRef.current?.contains(event.target)
      ) {
        setExportMenuOpen(false)
      }
    }

    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      event.stopPropagation()

      setExportMenuOpen(false)

      exportButtonRef.current?.focus({
        preventScroll: true,
      })
    }

    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)

    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape, true)
    }
  }, [exportMenuOpen])

  async function guardar() {
    const operation = scope.start('informe')
    if (!operation) return

    const isContextCurrent = scope.captureContext()
    const snapshot = contenido

    setGuardando(true)
    setError('')
    setAviso('')

    let result: QuejaInforme | null = null
    try {
      result = guardado && !dirty ? guardado : await guardarQuejaInforme({
        quejaId: queja.id,
        version: guardado?.version ?? 0,
        fuenteRevision,
        contenido: snapshot,
      })

      if (isContextCurrent()) {
        queryClient.setQueryData(quejaInformeKey(queja.id), result)
      }
      if (operation.isCurrent()) {
        setContenidoBase(result.contenido)
        setGuardado(result)
        onSaved?.(result)
      }

      const nombrePdf = informePdfFilename(queja.folio, result.version)
      const existentes = await fetchQuejaAdjuntos(queja.id)
      let pdf = existentes.find(file => file.nombre === nombrePdf
        && file.tipo_mime.toLowerCase() === 'application/pdf'
        && esOficioPublicableQueja(file, queja.id))

      if (!pdf) {
        const { crearInformePdf } = await import('@/lib/utils/quejaInformePdf')
        const contenidoPdf = await crearInformePdf(result.contenido)
        const archivo = new File([contenidoPdf], nombrePdf, { type: 'application/pdf' })
        pdf = await subirAdjuntoQueja(queja.id, archivo)
        if (!esOficioPublicableQueja(pdf, queja.id) || pdf.tipo_mime.toLowerCase() !== 'application/pdf') {
          throw new Error('No se confirmó un PDF oficial válido en el expediente.')
        }
      }
      if (isContextCurrent()) {
        queryClient.setQueryData(quejaAdjuntosKey(queja.id), current => {
          const actual = Array.isArray(current) ? current : existentes
          return actual.some(file => file.id === pdf.id) ? actual : [pdf, ...actual]
        })
      }
      if (operation.isCurrent()) {
        setAviso(`Versión ${result.version} guardada con su PDF oficial. El archivo se adjuntará automáticamente en la respuesta al cliente.`)
      }
    } catch (caught) {
      if (operation.isCurrent()) {
        setError(result
          ? `La versión ${result.version} se guardó, pero no se pudo adjuntar su PDF: ${errorMsg(caught, 'Error al subir el archivo.')}. Volvé a pulsar Guardar para reintentar sin crear otra versión.`
          : errorMsg(caught, 'No se pudo guardar el informe. Tu texto se conserva.'))
      }
    } finally {
      if (operation.isCurrent()) setGuardando(false)
      operation.finish()
    }
  }

  async function exportar() {
    const operation = scope.start('informe')

    if (!operation) return

    setExportando(true)
    setError('')

    try {
      const { crearInformeWord } = await import(
        '@/lib/utils/quejaInformeWord'
      )

      const blob = await crearInformeWord(contenido)

      if (!operation.isCurrent()) return

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = informeFilename(queja.folio)

      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      window.setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      )

      setAviso(
        dirty
          ? 'Word exportado con las ediciones actuales. Hay cambios pendientes de guardar en el expediente.'
          : 'Word exportado.'
      )
    } catch {
      if (operation.isCurrent()) {
        setError(
          'No se pudo exportar a Word. Tu texto se conserva; intentá de nuevo.'
        )
      }
    } finally {
      if (operation.isCurrent()) {
        setExportando(false)
      }

      operation.finish()
    }
  }

  async function exportarPdf() {
    const operation = scope.start('informe')

    if (!operation) return

    setExportandoPdf(true)
    setError('')

    try {
      const { crearInformePdf } = await import(
        '@/lib/utils/quejaInformePdf'
      )

      const blob = await crearInformePdf(contenido)

      if (!operation.isCurrent()) return

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url

      anchor.download = informeFilename(
        queja.folio
      ).replace(/\.docx$/, '.pdf')

      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      window.setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      )

      setAviso(
        dirty
          ? 'PDF exportado con las ediciones actuales. Hay cambios pendientes de guardar en el expediente.'
          : 'PDF exportado.'
      )
    } catch {
      if (operation.isCurrent()) {
        setError(
          'No se pudo exportar a PDF. Tu texto se conserva; intentá de nuevo.'
        )
      }
    } finally {
      if (operation.isCurrent()) {
        setExportandoPdf(false)
      }

      operation.finish()
    }
  }

  const close = () => {
    if (pending) return

    if (dirty) {
      setConfirmClose(true)
    } else {
      onClose()
    }
  }

  const saveStatus = guardando
    ? 'Guardando…'
    : dirty
      ? 'Cambios sin guardar'
      : guardado
        ? 'Guardado'
        : 'Pendiente de guardar'

  return (
    <>
      <Modal
        open
        onClose={close}
        title={`Informe del expediente · ${queja.folio}`}
        headerLeading={<InformeIcono />}
        variant="report"
        dismissOnBackdrop={false}
        dismissOnEscape={!exportMenuOpen}
        headerActions={
          <>
            {/* Separación adicional respecto a Guardar */}
            <span
              role="status"
              aria-live="polite"
              title={saveStatus}
              className="mr-5 hidden shrink-0 whitespace-nowrap text-xs text-qms-muted sm:inline-flex"
            >
              {saveStatus}
            </span>

            <Button
              size="sm"
              onClick={guardar}
              loading={guardando}
              disabled={
                pending ||
                Boolean(guardado && !dirty && pdfExiste) ||
                !contenido.trim()
              }
            >
              <Save className="size-4" />
              Guardar
            </Button>

            <div
              ref={exportMenuRef}
              className="relative"
            >
              <Button
                ref={exportButtonRef}
                variant="secondary"
                size="sm"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                aria-controls="queja-informe-export-menu"
                disabled={pending || !contenido.trim()}
                onClick={() =>
                  setExportMenuOpen(open => !open)
                }
              >
                Exportar
                <ChevronDown
                  aria-hidden="true"
                  className="size-4"
                />
              </Button>

              {exportMenuOpen && (
                <div
                  id="queja-informe-export-menu"
                  role="menu"
                  aria-label="Exportar informe"
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-card border border-qms-border bg-qms-surface p-1.5 text-qms-dark shadow-md"
                >
                  <Button
                    role="menuitem"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 whitespace-nowrap px-2"
                    disabled={pending}
                    onClick={() => {
                      setExportMenuOpen(false)
                      void exportar()
                    }}
                  >
                    <FileText
                      aria-hidden="true"
                      className="size-4 text-qms-muted"
                    />
                    Exportar a Word (.docx)
                  </Button>

                  <Button
                    role="menuitem"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 whitespace-nowrap px-2"
                    disabled={pending}
                    onClick={() => {
                      setExportMenuOpen(false)
                      void exportarPdf()
                    }}
                  >
                    <FileDown
                      aria-hidden="true"
                      className="size-4 text-qms-muted"
                    />
                    Exportar a PDF (.pdf)
                  </Button>
                </div>
              )}
            </div>
          </>
        }
      >
        {error && (
          <p
            role="alert"
            className="shrink-0 border-b border-qms-border bg-qms-surface px-4 py-2 text-sm text-qms-danger"
          >
            {error}
          </p>
        )}

        {aviso && (
          <p
            role="status"
            className="shrink-0 bg-qms-surface px-4 py-2 text-sm text-qms-muted"
          >
            {aviso}
          </p>
        )}

        {fuenteRevision !== queja.revision && (
          <p className="shrink-0 bg-qms-surface px-4 py-2 text-xs text-qms-muted">
            El caso tiene cambios posteriores a la base de
            este informe. Revisá su contenido antes de emitirlo.
          </p>
        )}

        <QuejaInformeHoja
          id={`informe-${queja.id}`}
          contenido={contenido}
          onChange={setContenido}
          onInitialized={value => {
            if (initializedRef.current) return

            initializedRef.current = true

            setContenido(value)
            setContenidoBase(value)
          }}
          disabled={pending}
        />
      </Modal>

      {confirmClose && (
        <ConfirmarSalida
          onCancel={() => setConfirmClose(false)}
          onDiscard={onClose}
        />
      )}
    </>
  )
}
