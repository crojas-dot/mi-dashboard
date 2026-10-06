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
  const login = useAuthStore((s) => s.login)
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const init = useAuthStore((s) => s.init)
  const router = useRouter()

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (initialized && user) router.replace('/')
  }, [user, initialized, router])

  if (!initialized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
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
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-card border border-qms-border bg-qms-surface p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-card bg-qms-primary text-xl font-bold text-white">E</div>
          <h2 className="m-0 text-xl font-bold text-qms-dark">ECA-QMS</h2>
          <p className="mt-1 text-[0.85rem] text-qms-muted">Sistema de Gestión de Calidad</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-qms-dark">Correo electrónico</label>
            <input type="email" required className="w-full rounded-button border border-qms-border px-3 py-2 text-sm outline-none focus:border-qms-primary focus:ring-1 focus:ring-qms-primary" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-qms-dark">Contraseña</label>
            <input type="password" required className="w-full rounded-button border border-qms-border px-3 py-2 text-sm outline-none focus:border-qms-primary focus:ring-1 focus:ring-qms-primary" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p className="text-sm text-qms-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-button border-0 bg-qms-primary py-2 text-sm font-medium text-white transition-colors hover:bg-qms-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
