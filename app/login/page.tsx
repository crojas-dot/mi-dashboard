'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, user, initialized, init } = useAuthStore()
  const router = useRouter()

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (initialized && user) router.replace('/')
  }, [user, initialized, router])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    if (result.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <div className="w-full max-w-sm rounded-xl bg-white p-8" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex items-center justify-center rounded-lg font-bold text-white" style={{ width: '44px', height: '44px', backgroundColor: '#0d6efd', fontSize: '20px' }}>E</div>
          <h2 className="font-bold m-0" style={{ fontSize: '1.25rem', color: '#212529' }}>ECA-QMS</h2>
          <p className="mt-1" style={{ color: '#6c757d', fontSize: '0.85rem' }}>Sistema de Gestión de Calidad</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Correo electrónico</label>
            <input type="email" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#dee2e6' }} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: '#212529' }}>Contraseña</label>
            <input type="password" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#dee2e6' }} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p className="text-sm" style={{ color: '#dc3545' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#0d6efd', border: 'none', cursor: 'pointer' }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
