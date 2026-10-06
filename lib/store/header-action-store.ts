import { create } from 'zustand'

export interface HeaderAction {
  label: string
  onClick: () => void
}

interface HeaderActionState {
  action: HeaderAction | null
  owner: string | null
  registerAction: (owner: string, action: HeaderAction) => void
  clearAction: (owner: string) => void
}

export const useHeaderActionStore = create<HeaderActionState>((set) => ({
  action: null,
  owner: null,
  registerAction: (owner, action) => set({ owner, action }),
  // Una ruta que termina de desmontarse no puede borrar la acción de la siguiente.
  clearAction: (owner) => set((state) => state.owner === owner ? { owner: null, action: null } : state),
}))
