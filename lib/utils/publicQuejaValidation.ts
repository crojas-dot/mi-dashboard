import { CATEGORIAS_PUBLICAS, type PublicCategory } from '@/lib/constants/publicForms'

export type PublicQuejaField = 'nombre' | 'email' | 'telefono' | 'categoria' | 'descripcion'
export const PUBLIC_QUEJA_LIMITES = { nombre: 50, email: 254, telefono: 25, descripcion: 10000 } as const

export interface PublicQuejaDraft {
  nombre: string
  email: string
  telefono: string
  categoria: string
  descripcion: string
}

const FIELD_ERRORS = {
  nombre: { code: 'invalid_public_nombre', short: 'Revisá el nombre: máximo 50 caracteres, solo letras.', message: 'El nombre es obligatorio; admite hasta 50 caracteres y solo letras, espacios, apóstrofes, guiones y puntos. No admite números ni símbolos.' },
  email: { code: 'invalid_public_email', short: 'Ingresá un correo electrónico válido.', message: 'Ingresá un correo electrónico válido, de hasta 254 caracteres y sin comas ni punto y coma.' },
  telefono: { code: 'invalid_public_telefono', short: 'Revisá el teléfono: máximo 25 caracteres, solo números y los signos + - ( ) .', message: 'El teléfono admite hasta 25 caracteres y solo números, espacios y los signos + - ( ) .; no admite letras.' },
  categoria: { code: 'invalid_public_categoria', short: 'Seleccioná un tipo de queja.', message: 'Seleccioná una categoría válida.' },
  descripcion: { code: 'invalid_public_descripcion', short: 'Revisá la descripción: no puede quedar vacía ni superar 10 000 caracteres.', message: 'La descripción es obligatoria y admite hasta 10000 caracteres, sin caracteres de control.' },
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

/** Aviso flotante breve; el `message` completo queda para lectores de pantalla y API. */
export function publicQuejaFieldMessage(field: PublicQuejaField): string {
  return FIELD_ERRORS[field].short
}

// El nombre de una persona admite letras (incluidas tildes y ñ), espacios, apóstrofes,
// guiones y puntos. Cualquier dígito o símbolo se rechaza en cliente y API.
const NAME_FORMAT = /^[\p{L}\p{M}\p{Zs}'’‘.\-‐‑]+$/u
const NAME_HAS_LETTER = /\p{L}/u
// Teléfono internacional: dígitos, espacios y signos de agrupación. Sin letras ni HTML.
const PHONE_FORMAT = /^\+?[\d\s().-]+$/
const PHONE_MIN_DIGITS = 6
// Marcas invisibles de dirección/sobreescritura, espacio de ancho cero y BOM: no aportan
// contenido visible y permiten ocultar o reordenar texto. Se rechazan en todos los campos.
const INVISIBLE_FORMATTING = /[\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/

function text(value: unknown, field: PublicQuejaField, maximum: number, required = true, multiline = false): string {
  if (value === undefined && !required) return ''
  if (typeof value !== 'string') throw new PublicQuejaValidationError(field)
  const normalized = value.normalize('NFC').trim().replace(/\r\n?/g, '\n')
  if ((!multiline && /[\r\n\t]/.test(normalized))
    || (required && !normalized) || normalized.length > maximum
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(normalized)
    || INVISIBLE_FORMATTING.test(normalized)) {
    throw new PublicQuejaValidationError(field)
  }
  return normalized
}

/** Cliente y API normalizan el mismo contenido antes de fijar su hash idempotente. */
export function validatePublicQuejaDraft(value: Partial<Record<PublicQuejaField, unknown>>): PublicQuejaDraft & { categoria: PublicCategory } {
  const nombre = text(value.nombre, 'nombre', PUBLIC_QUEJA_LIMITES.nombre)
  if (!NAME_HAS_LETTER.test(nombre) || !NAME_FORMAT.test(nombre)) throw new PublicQuejaValidationError('nombre')
  const email = text(value.email, 'email', PUBLIC_QUEJA_LIMITES.email).toLowerCase()
  // Algunas letras Unicode crecen al pasar a minúscula; el límite rige el valor que se envía.
  if (email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw new PublicQuejaValidationError('email')
  const telefono = text(value.telefono, 'telefono', PUBLIC_QUEJA_LIMITES.telefono, false)
  if (telefono && (!PHONE_FORMAT.test(telefono) || (telefono.match(/\d/g)?.length ?? 0) < PHONE_MIN_DIGITS)) throw new PublicQuejaValidationError('telefono')
  const categoria = text(value.categoria, 'categoria', 30)
  if (!(CATEGORIAS_PUBLICAS as readonly string[]).includes(categoria)) throw new PublicQuejaValidationError('categoria')
  const descripcion = text(value.descripcion, 'descripcion', PUBLIC_QUEJA_LIMITES.descripcion, true, true)
  return { nombre, email, telefono, categoria: categoria as PublicCategory, descripcion }
}
