import { esRolGestionable } from '@/lib/constants/roles'
import type { UserAccessSetup } from '@/lib/types/access'

type UsuarioInput = Partial<Record<'id' | 'nombre' | 'email' | 'rol' | 'estado' | 'newPassword', string>> & { access?: UserAccessSetup }
type Resultado = { data: UsuarioInput; error?: never } | { data?: never; error: string }

// Validar todo antes de Auth/perfil: el JSON externo no tiene garantías de TypeScript.
export function validarUsuarioInput(input: unknown, method: 'POST' | 'PATCH'): Resultado {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Body inválido' }
  const body = input as Record<string, unknown>
  const data: UsuarioInput = {}
  if (method === 'POST') {
    const access = body.access as Record<string, unknown>
    if (!access || typeof access !== 'object' || Array.isArray(access) || Object.keys(access).sort().join(',') !== 'id,invite,requireMfa,sendByEmail'
      || typeof access.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(access.id)
      || typeof access.sendByEmail !== 'boolean' || typeof access.invite !== 'boolean' || typeof access.requireMfa !== 'boolean' || body.password !== undefined || body.newPassword !== undefined) return { error: 'Configuración de acceso inválida' }
    data.access = { id: access.id.toLowerCase(), sendByEmail: access.sendByEmail, invite: access.invite, requireMfa: access.requireMfa }
  }
  const fields = method === 'POST'
    ? ['nombre', 'email', 'rol', 'estado'] as const
    : ['id', 'nombre', 'email', 'rol', 'estado', 'newPassword'] as const
  for (const field of fields) {
    const value = body[field]
    if (value === undefined) continue
    if (typeof value !== 'string') return { error: `El campo ${field} debe ser texto` }
    // Las contraseñas conservan espacios y mayúsculas exactamente como se envían.
    data[field] = field === 'newPassword' ? value : value.trim()
  }
  if (method === 'POST' && (!data.nombre || !data.email || !data.rol)) return { error: 'Nombre, email y rol son obligatorios' }
  if (method === 'PATCH' && !data.id) return { error: 'id obligatorio' }
  if (data.id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)) return { error: 'id inválido' }
  if (data.nombre !== undefined && !data.nombre) return { error: 'El nombre no puede estar vacío' }
  if (method === 'POST' && data.nombre && (/\r|\n/.test(data.nombre) || data.nombre.length > 200)) return { error: 'Ingresá un nombre de hasta 200 caracteres en una sola línea' }
  if (data.email !== undefined) {
    data.email = data.email.toLowerCase()
    if (data.email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(data.email)) return { error: 'Email inválido' }
  }
  if (data.rol !== undefined && !esRolGestionable(data.rol)) return { error: 'Rol inválido' }
  if (data.estado !== undefined && !['activo', 'inactivo'].includes(data.estado)) return { error: 'Estado inválido' }
  if (data.newPassword !== undefined && data.newPassword.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }
  if (method === 'PATCH' && !Object.keys(data).some((key) => key !== 'id')) return { error: 'Sin campos para actualizar' }
  return { data }
}
