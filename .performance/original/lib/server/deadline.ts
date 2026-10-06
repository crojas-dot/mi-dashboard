export function tiempoDisponible(deadline: number, maximo: number): number {
  const restante = deadline - Date.now()
  if (restante <= 0) throw new DOMException('Tiempo de análisis agotado', 'TimeoutError')
  return Math.min(maximo, restante)
}

// Interrumpe también helpers que todavía no exponen AbortSignal.
export function esperarConSignal<T>(operation: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Cancelado', 'AbortError'))
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(operation).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
