import { getUserError } from '@/lib/errors/userError'
import { normalizeApiError } from '@/lib/errors/apiError'

export interface LogContext {
  userId?: string
  module?: string
  action?: string
  timestamp?: string
  status?: number
  code?: string
}

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

function log(level: LogLevel, message: string, context: LogContext = {}, error?: unknown) {
  const normalized = normalizeApiError(error)
  const record = {
    level,
    message: getUserError({ message }, 'Evento de aplicación').message,
    environment: typeof window === 'undefined' ? 'server' : 'client',
    timestamp: new Date().toISOString(),
    userId: context.userId,
    module: context.module,
    action: context.action,
    status: context.status ?? normalized.status,
    code: getUserError({ code: context.code }).code ?? normalized.details,
  }
  // Desarrollo y producción: consola. Integrar Sentry/LogRocket aquí cuando
  // exista un destino configurado; nunca transmitir errores, tokens o SQL crudos.
  console.log(record)
}

export const logger = {
  error: (message: string, context?: LogContext, error?: unknown) => log(LogLevel.ERROR, message, context, error),
  warn: (message: string, context?: LogContext, error?: unknown) => log(LogLevel.WARN, message, context, error),
  info: (message: string, context?: LogContext) => log(LogLevel.INFO, message, context),
  debug: (message: string, context?: LogContext) => log(LogLevel.DEBUG, message, context),
}
