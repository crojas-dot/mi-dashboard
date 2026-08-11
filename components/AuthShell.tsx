'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuthStore } from '@/lib/store/auth-store'
import { Loader2 } from 'lucide-react'

const PUBLIC_PATHS = ['/login', '/q']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, initialized, init } = useAuthStore()

  useEffect(() => { init() }, [init])

  useEffect(() => {
    if (!initialized || loading) return
    const isPublic = isPublicPath(pathname)
    if (!user && !isPublic) {
      router.replace('/login')
    }
    if (user && pathname === '/login') {
      router.replace('/')
    }
  }, [user, loading, initialized, pathname, router])

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const isPublic = isPublicPath(pathname)

  if (isPublic || !user) {
    return <main>{children}</main>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  )
}
