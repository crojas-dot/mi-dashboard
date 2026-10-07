/** Validación de UX previa al alta; la autorización y constraints siguen en DB. */
export function trimTextFields<T extends Record<string, string | number>>(form: T): T {
  return Object.fromEntries(Object.entries(form).map(([key, value]) =>
    [key, typeof value === 'string' ? value.trim() : value])) as T
}

export function requireText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`Completa el campo ${label}.`)
}

export function requireOption(value: string, options: readonly string[], label: string): void {
  if (!options.includes(value)) throw new Error(`Selecciona una opción válida para ${label}.`)
}

export function validateDate(value: string, label: string, required = false): void {
  if (!value) {
    if (required) throw new Error(`Completa el campo ${label}.`)
    return
  }
  const date = new Date(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() < 1 || date.toISOString().slice(0, 10) !== value)
    throw new Error(`Revisa la fecha de ${label}.`)
}

export function validateDateOrder(start: string, end: string): void {
  if (start && end && end < start)
    throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.')
}

export function validateRiskScale(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 3)
    throw new Error(`Selecciona un valor de 1 a 3 para ${label}.`)
}
