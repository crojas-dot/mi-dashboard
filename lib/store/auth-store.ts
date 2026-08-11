'use client'

import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getAppUser, signIn, signOut } from '@/lib/auth'

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
  loading: boolean
  initialized: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  setPrefs: (prefs: { notif_habilitadas?: boolean; notif_sonido?: boolean; notif_sonido_id?: string }) => void
  setNotifSonidoId: (sonidoId: string) => void
  init: () => void
}

let initializedFlag = false

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
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
        set({ user: {
          id: appUser.id,
          email: appUser.email,
          nombre: appUser.nombre,
          rol: appUser.rol,
          notif_habilitadas: appUser.notif_habilitadas !== false,
          notif_sonido: appUser.notif_sonido !== false,
          notif_sonido_id: appUser.notif_sonido_id || 'notification/info',
        }, loading: false, initialized: true })
      } else {
        await supabase.auth.signOut()
        set({ user: null, loading: false, initialized: true })
      }
    } else {
      set({ user: null, loading: false, initialized: true })
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        getAppUser(session.user.id).then((appUser) => {
          if (appUser && appUser.estado === 'activo') {
            set({ user: {
              id: appUser.id,
              email: appUser.email,
              nombre: appUser.nombre,
              rol: appUser.rol,
              notif_habilitadas: appUser.notif_habilitadas !== false,
              notif_sonido: appUser.notif_sonido !== false,
              notif_sonido_id: appUser.notif_sonido_id || 'notification/info',
            }, loading: false, initialized: true })
          }
        })
      } else {
        set({ user: null, loading: false, initialized: true })
      }
    })
  },

  login: async (email, password) => {
    const result = await signIn(email, password)
    if (result.error) return { error: result.error }
    if (result.user) {
      set({ user: {
        id: result.user.id,
        email: result.user.email,
        nombre: result.user.nombre,
        rol: result.user.rol,
        notif_habilitadas: result.user.notif_habilitadas !== false,
        notif_sonido: result.user.notif_sonido !== false,
        notif_sonido_id: result.user.notif_sonido_id || 'notification/info',
      }, loading: false })
    }
    return {}
  },

  logout: async () => {
    await signOut()
    set({ user: null })
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
