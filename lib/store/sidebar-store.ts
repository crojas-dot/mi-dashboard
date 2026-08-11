import { create } from 'zustand'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (c: boolean) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (collapsed) => set({ collapsed }),
}))
