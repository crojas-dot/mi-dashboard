/**
 * @deprecated Store huérfano — no existe toggle de tema en la UI.
 * Se mantiene por compatibilidad pero no debe usarse en código nuevo.
 * Para implementar dark mode en el futuro, crear un toggle en Header
 * y conectar con este store.
 */
import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  toggle: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', next === 'dark')
      return { theme: next }
    }),
  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set({ theme })
  },
}))
