import { create } from 'zustand'

export const CONFIG_SECTION_LABELS = {
  general: 'Ajustes generales',
  identidad: 'Identidad',
  catalogos: 'Catálogos',
  sla: 'Plazos de atención',
  calendario: 'Calendario laboral',
  vistas: 'Vista por rol',
  formularios: 'Formularios públicos',
  ia: 'Asistente de IA',
} as const

export type ConfigSection = keyof typeof CONFIG_SECTION_LABELS

interface ConfigSectionState {
  section: ConfigSection
  setSection: (section: ConfigSection) => void
}

// La sección visible es compartida por el editor y su ruta en el encabezado.
export const useConfigSectionStore = create<ConfigSectionState>(set => ({
  section: 'catalogos',
  setSection: section => set({ section }),
}))
