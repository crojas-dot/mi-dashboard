import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Debe coincidir con prefix(tw) de ui-kit.css. El último className gana.
const merge = extendTailwindMerge({ prefix: 'tw' })

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs))
}
