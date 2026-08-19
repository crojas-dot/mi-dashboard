'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { showError, showSuccess } from '@/lib/services/errorToast'

const CATEGORIAS_PUBLICAS = ['Queja', 'Denuncia', 'Sugerencia', 'Reclamo', 'Felicitación']

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

export default function FormularioQuejaPublicaPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ''

  const [estado, setEstado] = useState<EstadoForm>({ status: 'cargando' })
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [folioRegistrado, setFolioRegistrado] = useState<string | null>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true)
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
      const folio = typeof res === 'string' ? res : res?.folio ?? ''
      setFolioRegistrado(folio)
      showSuccess('Queja registrada correctamente')
    } catch (err) {
      showError(err as Error, 'No se pudo registrar la queja')
    } finally {
      setEnviando(false)
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
        </div>
      </div>
    )
  }

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
            <input required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#dee2e6' }} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Correo electrónico *</label>
              <input type="email" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#dee2e6' }} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Teléfono</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#dee2e6' }} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Categoría *</label>
            <select required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#dee2e6', backgroundColor: '#fff' }} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Seleccionar categoría</option>
              {CATEGORIAS_PUBLICAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Descripción *</label>
            <textarea required rows={4} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#dee2e6' }} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#0d6efd', border: 'none', cursor: 'pointer' }}
          >
            {enviando ? 'Enviando...' : 'Enviar queja'}
          </button>
        </form>
      </div>
    </div>
  )
}
