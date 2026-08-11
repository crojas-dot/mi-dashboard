import { toast } from 'sonner'

type ErrorLike = { message?: string; details?: string; code?: string; hint?: string } | null

export function errorMsg(error: ErrorLike, fallback = 'Ocurrió un error'): string {
  if (!error) return fallback
  const msg = error.message || error.details || error.hint
  if (!msg) return error.code ? `${fallback} (${error.code})` : fallback
  return msg
}

export function showError(error: ErrorLike, fallback = 'Ocurrió un error'): void {
  console.error(fallback, error)
  toast.error(errorMsg(error, fallback))
}

export function showSuccess(message: string): void {
  toast.success(message)
}
