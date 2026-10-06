import { toast } from 'sonner'
import { getUserError } from '@/lib/errors/userError'

export function errorMsg(error: unknown, fallback = 'Ocurrió un error'): string {
  return getUserError(error, fallback).message
}

export function showError(error: unknown, fallback = 'Ocurrió un error'): void {
  const info = getUserError(error, fallback)
  // No enviar objetos de error completos a la consola del navegador:
  // pueden contener SQL, URLs privadas, credenciales o datos del usuario.
  console.warn('Operación no completada', info.code ?? 'APP_ERROR')
  toast.error(info.message)
}

export function showSuccess(message: string): void {
  toast.success(message)
}
