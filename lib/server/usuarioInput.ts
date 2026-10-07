type UsuarioInput = Partial<Record<'id' | 'nombre' | 'email' | 'rol' | 'estado' | 'password' | 'newPassword', string>>
type Resultado = { data: UsuarioInput; error?: never } | { data?: never; error: string }

// Validar todo ANTES de tocar Auth o el perfil. Un cast de TypeScript no valida
// JSON: antes, por ejemplo, un password inválido podía fallar tras cambiar el email.
export function validarUsuarioInput(input: unknown, method: 'POST' | 'PATCH'): Resultado {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Body inválido' }
  const body = input as Record<string, unknown>
  const data: UsuarioInput = {}
  const fields = method === 'POST'
    ? ['nombre', 'email', 'rol', 'estado', 'password'] as const
    : ['id', 'nombre', 'email', 'rol', 'estado', 'newPassword'] as const
  for (const field of fields) {
    const value = body[field]
    if (value === undefined) continue
    if (typeof value !== 'string') return { error: `El campo ${field} debe ser texto` }
    // Las contraseñas conservan espacios y mayúsculas exactamente como se envían.
    data[field] = field === 'password' || field === 'newPassword' ? value : value.trim()
  }
  if (method === 'POST' && (!data.nombre || !data.email || !data.rol)) return { error: 'Nombre, email y rol son obligatorios' }
  if (method === 'PATCH' && !data.id) return { error: 'id obligatorio' }
  if (data.id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)) return { error: 'id inválido' }
  if (data.nombre !== undefined && !data.nombre) return { error: 'El nombre no puede estar vacío' }
  if (data.email !== undefined) {
    data.email = data.email.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: 'Email inválido' }
  }
  if (data.rol !== undefined && !['admin', 'calidad', 'colaborador'].includes(data.rol)) return { error: 'Rol inválido' }
  if (data.estado !== undefined && !['activo', 'inactivo'].includes(data.estado)) return { error: 'Estado inválido' }
  const password = method === 'POST' ? data.password : data.newPassword
  if (password !== undefined && password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }
  if (method === 'PATCH' && !Object.keys(data).some((key) => key !== 'id')) return { error: 'Sin campos para actualizar' }
  return { data }
}
