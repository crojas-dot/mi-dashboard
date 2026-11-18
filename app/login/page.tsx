'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Mail } from 'lucide-react'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Input from '@/components/ui/Input'
import { useAuthStore } from '@/lib/store/auth-store'
import SessionScreen from '@/components/SessionScreen'
import { useLogoLogin } from '@/components/identidad/FondoIdentidad'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // La vista previa de credenciales de Chromium usa una fuente interna que
  // ignora el CSS. Permitir el llenado al entrar al formulario evita esa vista
  // previa al cargar, sin desactivar el gestor de contraseñas.
  const [credentialsEditable, setCredentialsEditable] = useState(false)
  const login = useAuthStore((s) => s.login)
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const init = useAuthStore((s) => s.init)
  const router = useRouter()
  const logo = useLogoLogin()

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (initialized && user) router.replace('/')
  }, [user, initialized, router])

  if (!initialized) {
    return <SessionScreen layout="login" />
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
    <div className="flex min-h-dvh items-center justify-center px-4 py-10 text-qms-dark antialiased">
      <div className="w-full max-w-md">
        <section aria-labelledby="login-title" className="overflow-hidden rounded-card border border-qms-border bg-qms-surface shadow-md">
          <header className="flex items-center gap-3 border-b border-qms-border px-6 py-5 sm:px-8">
            <div aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-card ${logo ? 'bg-[#232b35] p-1.5' : 'bg-qms-primary'}`}>
              {logo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logo} alt="" className="h-full w-full object-contain" fetchPriority="high" />
              ) : <span className="text-2xl font-semibold leading-none text-white">E</span>}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold tracking-tight text-qms-dark">QMS</p>
              <p className="mt-0.5 text-sm text-qms-muted">Gestión de Calidad</p>
            </div>
          </header>
          <div className="p-6 sm:p-8">
            <h1 id="login-title" className="text-center text-xl font-normal">Iniciar sesión</h1>
            <p className="mt-1 mb-6 text-center text-sm text-qms-muted">Ingresa a tu cuenta de Gestión de Calidad</p>

            <form
              onSubmit={handleSubmit}
              onPointerDownCapture={() => setCredentialsEditable(true)}
              onFocusCapture={() => setCredentialsEditable(true)}
              className="space-y-4"
            >
              <Field id="login-email" label="Correo electrónico">
                <div className="relative">
                  <Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-qms-muted" />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="nombre@ejemplo.com"
                    required
                    readOnly={!credentialsEditable}
                    className="ui-login-field pl-10"
                    aria-describedby={error ? 'login-error' : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </Field>
              <Field id="login-password" label="Contraseña">
                <div className="relative">
                  <LockKeyhole aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-qms-muted" />
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                    readOnly={!credentialsEditable}
                    className="ui-login-field pl-10"
                    aria-describedby={error ? 'login-error' : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </Field>

              {error && <p id="login-error" role="alert" className="text-sm text-qms-danger">{error}</p>}

              <Button type="submit" loading={loading} loadingLabel="Ingresando…" size="lg" className="w-full">
                {loading ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </div>

          <div className="rounded-b-card border-t border-qms-border bg-qms-hover-bg px-6 py-4 text-center text-sm text-qms-muted">
            ¿Necesitas acceso o recuperar tu contraseña?{' '}
            <span className="font-medium text-qms-primary">Contacta al administrador.</span>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-qms-muted">
          © {new Date().getFullYear()} ECA · Ente Costarricense de Acreditación
        </p>
      </div>
    </div>
  )
}
