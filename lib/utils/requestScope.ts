// Una generación representa una visita, no solo un ID: A → B → A sigue siendo otra visita.
// No aborta operaciones enviadas; decide si su respuesta todavía puede modificar esta vista.
export function createRequestScope() {
  let generation = 0
  let active = false

  return {
    activate() { generation++; active = true },
    invalidate() { generation++; active = false },
    capture() {
      const requestGeneration = generation
      return () => active && generation === requestGeneration
    },
  }
}
