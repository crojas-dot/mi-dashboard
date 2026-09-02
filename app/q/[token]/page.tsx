'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Paperclip, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'

const CATEGORIAS_PUBLICAS = ['Queja', 'Denuncia', 'Sugerencia', 'Reclamo', 'Felicitación']

const MAX_ADJUNTO_BYTES = 50 * 1024 * 1024
const EXTENSIONES_PERMITIDAS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
const ACCEPT_ADJUNTOS = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'

interface FormularioPublico {
  id: string
  modulo: string
  nombre: string
  token: string
  activo: boolean
}

interface EstadoForm {
  status: 'cargando' | 'ok' | 'invalid'
  formulario?: FormularioPublico
}

interface RespuestaUpload {
  drive_file_id: string
  name?: string
  mimeType?: string
  folder_id?: string
  queja_id: string
}

interface ResumenEvidencias {
  total: number
  subidos: number
  fallidos: string[]
}

function esFormatoPermitido(file: File): boolean {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSIONES_PERMITIDAS.includes(ext)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FormularioQuejaPublicaPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ''

  const [estado, setEstado] = useState<EstadoForm>({ status: 'cargando' })
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [etapaEnvio, setEtapaEnvio] = useState('')
  const [folioRegistrado, setFolioRegistrado] = useState<string | null>(null)
  const [resumenEvidencias, setResumenEvidencias] = useState<ResumenEvidencias | null>(null)

  useEffect(() => {
    let alive = true
    async function verificar() {
      if (!token) {
        setEstado({ status: 'invalid' })
        return
      }
      const { data, error } = await supabase
        .from('formularios_publicos')
        .select('*')
        .eq('token', token)
        .eq('activo', true)
        .maybeSingle()
      if (!alive) return
      if (error || !data) {
        setEstado({ status: 'invalid' })
        return
      }
      setEstado({ status: 'ok', formulario: data as FormularioPublico })
    }
    verificar()
    return () => { alive = false }
  }, [token])

  if (estado.status === 'cargando') {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (estado.status === 'invalid') {
    return (
      <div className="flex items-center justify-center p-4" style={{ minHeight: '100vh' }}>
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center" style={{ borderColor: '#dee2e6', boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
          <div className="mx-auto mb-3 flex items-center justify-center rounded-full font-bold text-white" style={{ width: '44px', height: '44px', backgroundColor: '#dc3545', fontSize: '20px' }}>!</div>
          <h2 className="font-bold m-0" style={{ fontSize: '1.15rem', color: '#212529' }}>Enlace no válido</h2>
          <p className="mt-2 text-sm" style={{ color: '#6c757d' }}>Este enlace no es válido o ya no está disponible.</p>
        </div>
      </div>
    )
  }

  const agregarArchivos = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return
    const rechazados: string[] = []
    const aceptados: File[] = []
    for (const f of Array.from(lista)) {
      if (!esFormatoPermitido(f)) {
        rechazados.push(`${f.name} (formato no permitido)`)
        continue
      }
      if (f.size > MAX_ADJUNTO_BYTES) {
        rechazados.push(`${f.name} (supera el límite de 50 MB)`)
        continue
      }
      aceptados.push(f)
    }
    setArchivos((prev) => {
      const claves = new Set(prev.map((p) => `${p.name}:${p.size}`))
      const nuevos = aceptados.filter((a) => {
        const k = `${a.name}:${a.size}`
        if (claves.has(k)) return false
        claves.add(k)
        return true
      })
      return [...prev, ...nuevos]
    })
    if (rechazados.length > 0) {
      showError(null, `No se adjuntaron ${rechazados.length} archivo(s): ${rechazados.join(', ')}`)
    }
  }

  const quitarArchivo = (index: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== index))
  }

  const subirEvidencias = async (folioNuevo: string): Promise<{ subidos: number; fallidosNombres: string[] }> => {
    let subidos = 0
    const fallidosNombres: string[] = []
    for (let i = 0; i < archivos.length; i++) {
      const f = archivos[i]
      setEtapaEnvio(`Subiendo evidencias (${i + 1} de ${archivos.length})...`)
      try {
        const fd = new FormData()
        fd.append('file', f)
        fd.append('folio', folioNuevo)
        fd.append('token', token)
        const res = await fetch('/api/drive/upload-public', { method: 'POST', body: fd })
        if (!res.ok) {
          const errData = await res.json().catch(() => null)
          throw new Error(errData?.error || 'Error al procesar el archivo')
        }
        const respuesta = (await res.json()) as RespuestaUpload
        if (!respuesta?.drive_file_id || !respuesta?.queja_id) {
          throw new Error('Respuesta inválida del servidor de subida')
        }
        const { error: rpcError } = await supabase.rpc('registrar_adjunto_queja_publica', {
          p_queja_id: respuesta.queja_id,
          p_nombre: f.name,
          p_storage_path: respuesta.drive_file_id,
          p_tamano: f.size,
          p_tipo_mime: f.type || 'application/octet-stream',
        })
        if (rpcError) {
          console.error('[RPC registrar_adjunto_queja_publica]', rpcError)
          throw new Error(rpcError.message || 'Error al vincular evidencia en BD')
        }
        subidos++
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err)
        console.error('[evidencia fallida]', f.name, err)
        fallidosNombres.push(f.name)
        showError(null, `Error al subir ${f.name}: ${mensaje}. Tu queja sigue registrada con el folio ${folioNuevo}.`)
      }
    }
    return { subidos, fallidosNombres }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setEtapaEnvio('Registrando queja...')
    setResumenEvidencias(null)
    try {
      const { data, error } = await supabase.rpc('crear_queja_publica', {
        p_token: token,
        p_cliente_nombre: nombre.trim(),
        p_email_cliente: email.trim(),
        p_telefono: telefono.trim(),
        p_categoria: categoria.trim(),
        p_descripcion: descripcion.trim(),
      })
      if (error) { showError(error, 'No se pudo registrar la queja'); return }
      const res = (data ?? {}) as { folio?: string } | string
      const folioNuevo = typeof res === 'string' ? res : res?.folio ?? ''
      if (!folioNuevo) throw new Error('La respuesta del servidor no incluyó el folio')

      let resumen: ResumenEvidencias | null = null
      if (archivos.length > 0) {
        const r = await subirEvidencias(folioNuevo)
        resumen = { total: archivos.length, subidos: r.subidos, fallidos: r.fallidosNombres }
      }

      setResumenEvidencias(resumen)
      setFolioRegistrado(folioNuevo)
      setArchivos([])
      showSuccess('Queja registrada correctamente')
    } catch (err) {
      showError(err instanceof Error ? err : null, 'No se pudo registrar la queja')
    } finally {
      setEnviando(false)
      setEtapaEnvio('')
    }
  }

  if (folioRegistrado) {
    return (
      <div className="flex items-center justify-center p-4" style={{ minHeight: '100vh' }}>
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center" style={{ borderColor: '#dee2e6', boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
          <div className="mx-auto mb-3 flex items-center justify-center rounded-full font-bold text-white" style={{ width: '44px', height: '44px', backgroundColor: '#198754', fontSize: '20px' }}>✓</div>
          <h2 className="font-bold m-0" style={{ fontSize: '1.15rem', color: '#212529' }}>Queja registrada</h2>
          <p className="mt-2 text-sm" style={{ color: '#6c757d' }}>
            Tu queja fue registrada con el número{' '}
            <strong className="font-mono" style={{ color: '#0d6efd' }}>{folioRegistrado}</strong>.
            Guardalo para dar seguimiento.
          </p>
          {resumenEvidencias && resumenEvidencias.subidos > 0 && (
            <p className="mt-3 text-sm font-medium m-0" style={{ color: '#198754' }}>
              Se adjuntaron {resumenEvidencias.subidos} de {resumenEvidencias.total} evidencia(s) correctamente.
            </p>
          )}
          {resumenEvidencias && resumenEvidencias.fallidos.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed m-0" style={{ color: '#dc3545' }}>
              No se pudieron subir: {resumenEvidencias.fallidos.join(', ')}. Podés reportarlo citando tu folio.
            </p>
          )}
        </div>
      </div>
    )
  }

  const campoDeshabilitado = enviando

  return (
    <div className="flex items-center justify-center p-4" style={{ minHeight: '100vh' }}>
      <div className="w-full max-w-lg rounded-lg border bg-white p-8" style={{ borderColor: '#dee2e6', boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex items-center justify-center rounded-lg font-bold text-white" style={{ width: '44px', height: '44px', backgroundColor: '#0d6efd', fontSize: '20px' }}>E</div>
          <h2 className="font-bold m-0" style={{ fontSize: '1.25rem', color: '#212529' }}>Registro de queja</h2>
          <p className="mt-1" style={{ color: '#6c757d', fontSize: '0.85rem' }}>{estado.formulario?.nombre || 'Formulario de quejas'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Nombre *</label>
            <input required disabled={campoDeshabilitado} className="w-full rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70" style={{ borderColor: '#dee2e6' }} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Correo electrónico *</label>
              <input type="email" required disabled={campoDeshabilitado} className="w-full rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70" style={{ borderColor: '#dee2e6' }} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Teléfono</label>
              <input disabled={campoDeshabilitado} className="w-full rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70" style={{ borderColor: '#dee2e6' }} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Categoría *</label>
            <select required disabled={campoDeshabilitado} className="w-full rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70" style={{ borderColor: '#dee2e6', backgroundColor: '#fff' }} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Seleccionar categoría</option>
              {CATEGORIAS_PUBLICAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Descripción *</label>
            <textarea required rows={4} disabled={campoDeshabilitado} className="w-full rounded-lg border px-3 py-2 text-sm resize-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70" style={{ borderColor: '#dee2e6' }} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Evidencias (opcional)</label>
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors hover:bg-gray-50 ${enviando ? 'pointer-events-none opacity-60' : ''}`} style={{ borderColor: '#dee2e6' }}>
              <Paperclip className="h-4 w-4 shrink-0" style={{ color: '#6c757d' }} />
              <span style={{ color: '#6c757d' }}>
                {archivos.length > 0 ? `${archivos.length} archivo(s) seleccionado(s)` : 'Adjuntar imágenes, videos, PDF u Office (máx. 50 MB c/u)'}
              </span>
              <input
                type="file"
                multiple
                accept={ACCEPT_ADJUNTOS}
                className="hidden"
                disabled={enviando}
                onChange={(e) => {
                  agregarArchivos(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            {archivos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {archivos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex select-text items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: '#dee2e6' }}>
                    <span className="min-w-0 flex-1 truncate text-xs" style={{ color: '#212529' }}>{f.name}</span>
                    <span className="whitespace-nowrap text-xs" style={{ color: '#6c757d' }}>{formatBytes(f.size)}</span>
                    <button type="button" onClick={() => quitarArchivo(i)} disabled={enviando} title="Quitar archivo" className="shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" style={{ color: '#6c757d' }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-white transition-opacity disabled:cursor-wait disabled:opacity-50"
            style={{ backgroundColor: '#0d6efd', border: 'none' }}
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? (etapaEnvio || 'Enviando...') : 'Enviar queja'}
          </button>
        </form>
      </div>
    </div>
  )
}
