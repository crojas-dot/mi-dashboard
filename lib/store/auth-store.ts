'use client'

import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getAppUser, signIn, signOut } from '@/lib/auth'
import type { Permiso } from '@/lib/permisos'
import { fetchPermisosByRol } from '@/lib/queries/usePermisos'
import { logger } from '@/lib/utils/logger'
import { clearLogoutPending, isLogoutPending, markLogoutPending } from '@/lib/authLogoutIntent'

export interface AppUser {
  id: string
  email: string
  nombre: string
  rol: string
  notif_habilitadas?: boolean
  notif_sonido?: boolean
  notif_sonido_id?: string
}

interface AuthState {
  user: AppUser | null
  permisos: Permiso[]
  vistaActiva: string | null
  loading: boolean
  initialized: boolean
  signingOut: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  setPrefs: (prefs: { notif_habilitadas?: boolean; notif_sonido?: boolean; notif_sonido_id?: string }) => void
  setNotifSonidoId: (sonidoId: string) => void
  setVistaActiva: (rol: string | null) => Promise<void>
  init: () => void
}

let initializedFlag = false
let authRevision = 0
let currentAuthId: string | null = null
let authAction: 'login' | 'logout' | null = null

async function fetchMisPermisos(): Promise<Permiso[]> {
  const { data, error } = await supabase.rpc('app_mis_permisos')
  if (error) return []
  return (data as Permiso[]) ?? []
}

function toAppUser(appUser: { id: string; email: string; nombre: string; rol: string; notif_habilitadas?: boolean; notif_sonido?: boolean; notif_sonido_id?: string }) {
  return {
    id: appUser.id,
    email: appUser.email,
    nombre: appUser.nombre,
    rol: appUser.rol,
    notif_habilitadas: appUser.notif_habilitadas !== false,
    notif_sonido: appUser.notif_sonido !== false,
    notif_sonido_id: appUser.notif_sonido_id || 'notification/info',
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  const clearSession = (loading = false) => {
    currentAuthId = null
    set({ user: null, permisos: [], vistaActiva: null, loading, initialized: true, signingOut: authAction === 'logout' })
  }

  const resolveSession = async (authId: string, revision: number) => {
    try {
      // La sesión local solo sirve para detectar credenciales; Auth confirma la identidad.
      const { data, error } = await supabase.auth.getUser()
      if (revision !== authRevision || isLogoutPending()) return
      if (error) throw error
      if (!data.user || data.user.id !== authId) {
        clearSession()
        return
      }
      // Lecturas independientes, ambas con autorización en DB; publicar solo al terminar las dos.
      const [appUser, permisos] = await Promise.all([getAppUser(authId), fetchMisPermisos()])
      if (revision !== authRevision || isLogoutPending()) return
      if (!appUser || appUser.estado !== 'activo') {
        clearSession()
        await supabase.auth.signOut()
        return
      }
      currentAuthId = authId
      set({ user: toAppUser(appUser), permisos, vistaActiva: null, loading: false, initialized: true, signingOut: false })
    } catch (error) {
      if (revision !== authRevision || isLogoutPending()) return
      logger.error('No se pudo comprobar la sesión', { module: 'auth', action: 'resolve_session' }, error)
      clearSession()
    }
  }

  return {
    user: null,
    permisos: [],
    vistaActiva: null,
    loading: true,
    initialized: false,
    signingOut: false,

    init: async () => {
      if (initializedFlag) return
      initializedFlag = true
      const revision = ++authRevision
      supabase.auth.onAuthStateChange((event, session) => {
        // La lectura inicial la administra getSession; el callback no espera llamadas SDK.
        if (event === 'INITIAL_SESSION') return
        if (!session?.user) {
          ++authRevision
          clearSession(authAction === 'logout')
          return
        }
        if (authAction || isLogoutPending()) return
        const authId = session.user.id
        // Refresh y foco no deben reiniciar permisos, caché ni simulaciones vigentes.
        if (currentAuthId === authId && get().user && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) return
        const eventRevision = ++authRevision
        if (currentAuthId !== authId) clearSession(true)
        currentAuthId = authId
        // Salir del bloqueo interno de Auth antes de consultar perfil/permisos.
        setTimeout(() => {
          if (eventRevision === authRevision) void resolveSession(authId, eventRevision)
        }, 0)
      })
      // Una recarga durante logout debe continuar cerrando, nunca restaurar el perfil.
      if (isLogoutPending()) {
        await get().logout()
        return
      }
      try {
        const { data, error } = await supabase.auth.getSession()
        if (revision !== authRevision) return
        if (error) throw error
        const authId = data.session?.user.id
        if (authId) await resolveSession(authId, revision)
        else clearSession()
      } catch (error) {
        if (revision !== authRevision) return
        logger.error('No se pudo iniciar la sesión', { module: 'auth', action: 'init_session' }, error)
        clearSession()
      }
    },

    login: async (email, password) => {
      if (authAction === 'logout') return { error: 'Espera a que termine el cierre de sesión.' }
      const revision = ++authRevision
      authAction = 'login'
      try {
        const result = await signIn(email, password)
        if (revision !== authRevision) return { error: 'La sesión cambió. Vuelve a iniciar sesión.' }
        if (result.error) return { error: result.error }
        if (!result.user) return { error: 'No se pudo iniciar sesión.' }
        // Confirmar la identidad actual antes de publicar perfil y permisos.
        const [permisos, { data, error }] = await Promise.all([fetchMisPermisos(), supabase.auth.getUser()])
        if (revision !== authRevision) return { error: 'La sesión cambió. Vuelve a iniciar sesión.' }
        if (error || !data.user) return { error: 'La sesión terminó. Vuelve a iniciar sesión.' }
        if (data.user.id !== result.authId) return { error: 'La sesión cambió. Vuelve a iniciar sesión.' }
        // Solo un login explícito y confirmado puede abandonar un cierre pendiente.
        clearLogoutPending()
        currentAuthId = data.user.id
        set({ user: toAppUser(result.user), permisos, vistaActiva: null, loading: false, initialized: true, signingOut: false })
        return {}
      } catch (error) {
        logger.error('No se pudo iniciar sesión', { module: 'auth', action: 'login' }, error)
        return { error: 'No se pudo iniciar sesión. Inténtalo de nuevo.' }
      } finally {
        if (authAction === 'login') authAction = null
      }
    },

    logout: async () => {
      ++authRevision
      authAction = 'logout'
      markLogoutPending()
      // Desmontar pantallas privadas y su caché antes de esperar a la red.
      clearSession(true)
      try {
        await signOut()
        clearLogoutPending()
      } catch (error) {
        logger.error('No se pudo terminar el cierre de sesión', { module: 'auth', action: 'logout' }, error)
      } finally {
        ++authRevision
        authAction = null
        clearSession()
      }
    },

    setVistaActiva: async (rol) => {
      const revision = authRevision
      if (rol === null || rol === undefined) {
        const permisos = await fetchMisPermisos()
        if (revision !== authRevision || !get().user) return
        set({ vistaActiva: null, permisos })
        return
      }
      const permisos = await fetchPermisosByRol(rol)
      if (revision !== authRevision || !get().user) return
      set({ vistaActiva: rol, permisos })
    },

    setPrefs: (prefs) => {
      set((state) => ({
        user: state.user ? { ...state.user, ...prefs } : null,
      }))
    },
    setNotifSonidoId: (sonidoId) => {
      set((state) => ({
        user: state.user ? { ...state.user, notif_sonido_id: sonidoId } : null,
      }))
    },
  }
})
