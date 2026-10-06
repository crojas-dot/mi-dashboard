'use client'

export interface ChartColors {
  primary: string
  success: string
  info: string
  warning: string
  danger: string
  secondary: string
  purple: string
  body: string
  muted: string
  grid: string
}

// Fallbacks documentados de ECA-QMS (app/styles/tokens.css).
const FALLBACK: ChartColors = {
  primary: '#4257be',
  success: '#1b9e3e',
  info: '#3399ff',
  warning: '#f9b115',
  danger: '#e55353',
  secondary: '#6c757d',
  purple: '#6f42c1',
  body: 'rgba(37, 42.92, 54.02, 0.95)',
  muted: 'rgba(37, 42.92, 54.02, 0.681)',
  grid: 'rgba(49, 72, 112, 0.175)',
}

const VARIABLES: Record<keyof ChartColors, string> = {
  primary: '--color-qms-primary',
  success: '--color-qms-success',
  info: '--color-qms-info',
  warning: '--color-qms-warning',
  danger: '--color-qms-danger',
  secondary: '--color-qms-muted',
  purple: '--color-soft-purple-text',
  body: '--color-qms-foreground',
  muted: '--color-qms-muted-foreground',
  grid: '--color-qms-grid',
}

let cache: ChartColors | null = null

/** Chart.js reads the same stable tokens as Tailwind, without a UI dependency. */
export function chartColors(): ChartColors {
  if (typeof window === 'undefined') return FALLBACK
  if (cache) return cache
  const root = document.documentElement
  const computed = getComputedStyle(root)
  const leer = (prop: string, fallback: string) => computed.getPropertyValue(prop).trim() || fallback
  cache = {
    primary: leer(VARIABLES.primary, FALLBACK.primary),
    success: leer(VARIABLES.success, FALLBACK.success),
    info: leer(VARIABLES.info, FALLBACK.info),
    warning: leer(VARIABLES.warning, FALLBACK.warning),
    danger: leer(VARIABLES.danger, FALLBACK.danger),
    secondary: leer(VARIABLES.secondary, FALLBACK.secondary),
    purple: leer(VARIABLES.purple, FALLBACK.purple),
    body: leer(VARIABLES.body, FALLBACK.body),
    muted: leer(VARIABLES.muted, FALLBACK.muted),
    grid: leer(VARIABLES.grid, FALLBACK.grid),
  }
  return cache
}
