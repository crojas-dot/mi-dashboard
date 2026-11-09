import { CATEGORIAS_PUBLICAS, type PublicCategory } from '@/lib/constants/publicForms'

export type PublicQuejaField = 'nombre' | 'email' | 'telefono' | 'categoria' | 'descripcion'

export interface PublicQuejaDraft {
  nombre: string
  email: string
  telefono: string
  categoria: string
  descripcion: string
}

const FIELD_ERRORS = {
  nombre: { code: 'invalid_public_nombre', message: 'El nombre es obligatorio y admite hasta 150 caracteres, sin saltos de línea ni caracteres de control.' },
  email: { code: 'invalid_public_email', message: 'Ingresá un correo electrónico válido, de hasta 254 caracteres y sin comas ni punto y coma.' },
  telefono: { code: 'invalid_public_telefono', message: 'El teléfono admite hasta 40 caracteres, sin saltos de línea ni caracteres de control.' },
  categoria: { code: 'invalid_public_categoria', message: 'Seleccioná una categoría válida.' },
  descripcion: { code: 'invalid_public_descripcion', message: 'La descripción es obligatoria y admite hasta 10000 caracteres, sin caracteres de control.' },
} as const

export class PublicQuejaValidationError extends Error {
  readonly code: (typeof FIELD_ERRORS)[PublicQuejaField]['code']

  constructor(public readonly field: PublicQuejaField) {
    super(FIELD_ERRORS[field].message)
    this.code = FIELD_ERRORS[field].code
  }
}

/** Solo códigos propios permiten marcar un campo; un diagnóstico remoto no es una etiqueta. */
export function publicQuejaFieldFromCode(code: unknown): PublicQuejaField | null {
  for (const field of Object.keys(FIELD_ERRORS) as PublicQuejaField[]) {
    if (FIELD_ERRORS[field].code === code) return field
  }
  return null
}

function text(value: unknown, field: PublicQuejaField, maximum: number, required = true, multiline = false): string {
  if (value === undefined && !required) return ''
  if (typeof value !== 'string') throw new PublicQuejaValidationError(field)
  const normalized = value.normalize('NFC').trim().replace(/\r\n?/g, '\n')
  if ((!multiline && /[\r\n\t]/.test(normalized))
    || (required && !normalized) || normalized.length > maximum
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new PublicQuejaValidationError(field)
  }
  return normalized
}

/** Cliente y API normalizan el mismo contenido antes de fijar su hash idempotente. */
export function validatePublicQuejaDraft(value: Partial<Record<PublicQuejaField, unknown>>): PublicQuejaDraft & { categoria: PublicCategory } {
  const nombre = text(value.nombre, 'nombre', 150)
  const email = text(value.email, 'email', 254).toLowerCase()
  // Algunas letras Unicode crecen al pasar a minúscula; el límite rige el valor que se envía.
  if (email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw new PublicQuejaValidationError('email')
  const telefono = text(value.telefono, 'telefono', 40, false)
  const categoria = text(value.categoria, 'categoria', 30)
  if (!(CATEGORIAS_PUBLICAS as readonly string[]).includes(categoria)) throw new PublicQuejaValidationError('categoria')
  const descripcion = text(value.descripcion, 'descripcion', 10000, true, true)
  return { nombre, email, telefono, categoria: categoria as PublicCategory, descripcion }
}
