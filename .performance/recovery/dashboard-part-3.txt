'use client'
import { getStyle } from '@coreui/utils'

export interface CuiColors {
  primary: string
  success: string
  info: string
  warning: string
  danger: string
  secondary: string
  body: string
  muted: string
  grid: string
}

// Fallbacks documentados de ECA-QMS (app/styles/tokens.css + coreui-bridge.css).
const FALLBACK: CuiColors = {
  primary: '#4257be',
  success: '#1b9e3e',
  info: '#3399ff',
  warning: '#f9b115',
  danger: '#e55353',
  secondary: '#6c757d',
  body: 'rgba(37, 42.92, 54.02, 0.95)',
  muted: 'rgba(37, 42.92, 54.02, 0.681)',
  grid: 'rgba(49, 72, 112, 0.175)',
}

const VARIABLES: Record<keyof CuiColors, string> = {
  primary: '--color-qms-primary',
  success: '--color-qms-success',
  info: '--color-qms-info',
  warning: '--color-qms-warning',
  danger: '--color-qms-danger',
  secondary: '--color-qms-muted',
  body: '--cui-body-color',
  muted: '--cui-secondary-color',
  grid: '--cui-border-color-translucent',
}

let cache: CuiColors | null = null

/** Paleta semántica CoreUI leída del scope real (getStyle de @coreui/utils). */
export function cuiColors(): CuiColors {
  if (typeof window === 'undefined') return FALLBACK
  if (cache) return cache
  const root = document.querySelector<HTMLElement>('.coreui-scope') ?? document.documentElement
  const leer = (prop: string, fallback: string) => getStyle(prop, root) || fallback
  cache = {
    primary: leer(VARIABLES.primary, FALLBACK.primary),
    success: leer(VARIABLES.success, FALLBACK.success),
    info: leer(VARIABLES.info, FALLBACK.info),
    warning: leer(VARIABLES.warning, FALLBACK.warning),
    danger: leer(VARIABLES.danger, FALLBACK.danger),
    secondary: leer(VARIABLES.secondary, FALLBACK.secondary),
    body: leer(VARIABLES.body, FALLBACK.body),
    muted: leer(VARIABLES.muted, FALLBACK.muted),
    grid: leer(VARIABLES.grid, FALLBACK.grid),
  }
  return cache
}
