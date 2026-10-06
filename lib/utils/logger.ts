export interface LogContext {
  userId?: string
  module?: string
  action?: string
  timestamp?: string
  [key: string]: any
}

enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

function getTimestamp(): string {
  return new Date().toISOString()
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = context?.timestamp || getTimestamp()
  const contextStr = context ? JSON.stringify(context, null, 2) : ''
  return `[${timestamp}] [${level}] ${message}\n${contextStr}`
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const formatted = formatLog(level, message, context)

  if (typeof window === 'undefined') {
    if (level === LogLevel.ERROR) console.error(formatted)
    else if (level === LogLevel.WARN) console.warn(formatted)
    else console.log(formatted)
    return
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(formatted)
  } else {
    console.log(formatted)
  }
}

export const logger = {
  error: (message: string, context?: LogContext) => log(LogLevel.ERROR, message, context),
  warn: (message: string, context?: LogContext) => log(LogLevel.WARN, message, context),
  info: (message: string, context?: LogContext) => log(LogLevel.INFO, message, context),
  debug: (message: string, context?: LogContext) => log(LogLevel.DEBUG, message, context),
}
