// Una generación representa una visita, no solo un ID: A → B → A sigue siendo otra visita.
// No aborta operaciones enviadas; decide si su respuesta todavía puede modificar esta vista.
export function createRequestScope() {
  let generation = 0
  let active = false
  const operations = new Map<string, symbol>()

  const capture = () => {
    const requestGeneration = generation
    return () => active && generation === requestGeneration
  }

  return {
    activate() { generation++; active = true; operations.clear() },
    invalidate() { generation++; active = false; operations.clear() },
    capture,
    start(key: string) {
      if (!active || operations.has(key)) return null
      const token = Symbol(key)
      const isCurrent = capture()
      operations.set(key, token)
      return {
        isCurrent,
        finish() {
          // Una respuesta anterior nunca libera el bloqueo de una visita nueva.
          if (isCurrent() && operations.get(key) === token) operations.delete(key)
        },
      }
    },
  }
}

export type RequestScope = ReturnType<typeof createRequestScope>
