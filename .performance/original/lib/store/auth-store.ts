'use client'

import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getAppUser, signIn, signOut } from '@/lib/auth'
import type { Permiso } from '@/lib/permisos'
import { fetchPermisosByRol } from '@/lib/queries/usePermisos'

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
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  setPrefs: (prefs: { notif_habilitadas?: boolean; notif_sonido?: boolean; notif_sonido_id?: string }) => void
  setNotifSonidoId: (sonidoId: string) => void
  setVistaActiva: (rol: string | null) => Promise<void>
  init: () => void
}

let initializedFlag = false

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permisos: [],
  vistaActiva: null,
  loading: true,
  initialized: false,

  init: async () => {
    if (initializedFlag) return
    initializedFlag = true
    const { data } = await supabase.auth.getSession()
    const sessionUser = data.session?.user ?? null

    if (sessionUser) {
      const appUser = await getAppUser(sessionUser.id)
      if (appUser && appUser.estado === 'activo') {
        const permisos = await fetchMisPermisos()
        set({ user: toAppUser(appUser), permisos, loading: false, initialized: true })
      } else {
        await supabase.auth.signOut()
        set({ user: null, permisos: [], loading: false, initialized: true })
      }
    } else {
      set({ user: null, permisos: [], loading: false, initialized: true })
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        getAppUser(session.user.id).then(async (appUser) => {
          if (appUser && appUser.estado === 'activo') {
            const permisos = await fetchMisPermisos()
            set({ user: toAppUser(appUser), permisos, vistaActiva: null, loading: false, initialized: true })
          } else {
            set({ user: null, permisos: [], vistaActiva: null, loading: false, initialized: true })
          }
        })
      } else {
        set({ user: null, permisos: [], vistaActiva: null, loading: false, initialized: true })
      }
    })
  },

  login: async (email, password) => {
    const result = await signIn(email, password)
    if (result.error) return { error: result.error }
    if (result.user) {
      const permisos = await fetchMisPermisos()
      set({ user: toAppUser(result.user), permisos, loading: false })
    }
    return {}
  },

  logout: async () => {
    await signOut()
    set({ user: null, permisos: [], vistaActiva: null })
  },

  setVistaActiva: async (rol) => {
    if (rol === null || rol === undefined) {
      const permisos = await fetchMisPermisos()
      set({ vistaActiva: null, permisos })
      return
    }
    const permisos = await fetchPermisosByRol(rol)
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
}))