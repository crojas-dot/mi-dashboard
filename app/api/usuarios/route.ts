import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'
import { rateLimit, getClientIp } from '@/lib/server/rateLimit'
import { completarUltimoAcceso } from '@/lib/server/ultimoAcceso'
import { logger } from '@/lib/utils/logger'
import { validarUsuarioInput } from '@/lib/server/usuarioInput'
import { containsPattern } from '@/lib/utils/postgrest'
import { generatePassword } from '@/lib/services/passwordGenerator'
import { getUserError } from '@/lib/errors/userError'

export const runtime = 'nodejs'
const json = (value: unknown, options: {status?: number; headers?: Record<string,string>} = {}) => NextResponse.json(value, {
  ...options, headers: { ...options.headers, 'Cache-Control': 'no-store' },
})

function falloSeguro(error: unknown, action: string, fallback: string, status = 500) {
  logger.error(fallback, { module: 'usuarios', action }, error)
  return json({ error: getUserError(error, fallback).message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function parseBody(request: NextRequest) {
  return request.json().catch(() => null)
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, 20, 60_000, 'usuarios')) {
    return json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' }, { status: 429 })
  }

  const current = await getCurrentUser(request, request.signal)
  if (!current) {
    return json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!['admin', 'calidad'].includes(current.rol)) {
    return json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const rol = searchParams.get('rol') || ''
  const estado = searchParams.get('estado') || ''

  const admin = createServiceClient()
  if (!admin) {
    return json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  let query = admin.from('usuarios').select('id, email, nombre, rol, estado, auth_id, ultimo_acceso').order('nombre')

  if (search.trim()) {
    const pattern = containsPattern(search.trim())
    query = query.or(`nombre.ilike.${pattern},email.ilike.${pattern}`)
  }
  if (rol) {
    query = query.eq('rol', rol)
  }
  if (estado) {
    query = query.eq('estado', estado)
  }

  const { data, error } = await query.abortSignal(request.signal)

  if (error) {
    return falloSeguro(error, 'list', 'No se pudo listar usuarios.', 500)
  }
  try {
    return json(await completarUltimoAcceso(admin, data ?? []), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error('No se pudo consultar el último acceso', { module: 'usuarios', action: 'list_access' }, error)
    return json({ error: 'No se pudo consultar el último acceso de los usuarios.' }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, 20, 60_000, 'usuarios')) {
    return json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' }, { status: 429 })
  }

  const current = await getCurrentUser(request, request.signal)
  if (!current) {
    return json({ error: 'No autorizado' }, { status: 401 })
  }
  if (current.rol !== 'admin') {
    return json({ error: 'Solo administradores' }, { status: 403 })
  }

  const validation = validarUsuarioInput(await parseBody(request), 'POST')
  if (validation.error) return json({ error: validation.error }, { status: 400 })
  const { nombre, email, rol, estado = 'activo', password } = validation.data!
  const tempPassword = password ?? generatePassword()

  const admin = createServiceClient()
  if (!admin) {
    return json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { nombre },
  })

  if (authError) {
    return falloSeguro(authError, 'create_auth', 'No se pudo crear la cuenta.', 400)
  }
  const newUserId = authUser.user.id

  const { error: insertError } = await admin.from('usuarios').insert([
    {
      auth_id: newUserId,
      email,
      nombre,
      rol,
      estado,
      ultimo_acceso: null,
    },
  ])

  if (insertError) {
    await admin.auth.admin.deleteUser(newUserId)
    return falloSeguro(insertError, 'create_profile', 'No se pudo crear el perfil.', 500)
  }

  return json({ ok: true, userId: newUserId, tempPassword: tempPassword }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, 20, 60_000, 'usuarios')) {
    return json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' }, { status: 429 })
  }

  const current = await getCurrentUser(request, request.signal)
  if (!current) {
    return json({ error: 'No autorizado' }, { status: 401 })
  }
  if (current.rol !== 'admin') {
    return json({ error: 'Solo administradores' }, { status: 403 })
  }

  const validation = validarUsuarioInput(await parseBody(request), 'PATCH')
  if (validation.error) return json({ error: validation.error }, { status: 400 })
  const { id, nombre, rol, estado, email, newPassword } = validation.data!

  const admin = createServiceClient()
  if (!admin) {
    return json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const { data: userRow, error: fetchError } = await admin.from('usuarios').select('auth_id').eq('id', id).maybeSingle()
  if (fetchError || !userRow) {
    return json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  const authId = userRow.auth_id

  if (current.auth_id === authId) {
    if (estado !== undefined && estado === 'inactivo') {
      return json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }
    if (rol !== undefined && rol !== 'admin') {
      return json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
    }
  }

  // Verificar que no se quede sin admins activos
  if (rol !== undefined || estado !== undefined) {
    const { data: targetUser } = await admin.from('usuarios').select('rol, estado').eq('id', id).maybeSingle()
    if (targetUser?.rol === 'admin' && targetUser?.estado === 'activo') {
      const nuevoRol = rol ?? targetUser.rol
      const nuevoEstado = estado ?? targetUser.estado
      if (nuevoRol !== 'admin' || nuevoEstado !== 'activo') {
        const { count } = await admin.from('usuarios').select('id', { count: 'exact', head: true }).eq('rol', 'admin').eq('estado', 'activo')
        if ((count ?? 0) <= 1) {
          return json({ error: 'No se puede dejar el sistema sin administradores activos' }, { status: 409 })
        }
      }
    }
  }

  const updates: Record<string, unknown> = {}

  if (nombre !== undefined) {
    updates.nombre = nombre.trim()
  }
  if (rol !== undefined) {
    updates.rol = rol
  }
  if (estado !== undefined) {
    updates.estado = estado
  }
  const authUpdates: { email?: string; password?: string } = {}
  if (email !== undefined) { authUpdates.email = email; updates.email = email }
  if (newPassword !== undefined) authUpdates.password = newPassword
  if (Object.keys(authUpdates).length) {
    const { error: authError } = await admin.auth.admin.updateUserById(authId, authUpdates)
    if (authError) return falloSeguro(authError, 'update_auth', 'No se pudo actualizar la cuenta.', 400)
  }

  if (Object.keys(updates).length === 0 && newPassword === undefined) {
    return json({ error: 'Sin campos para actualizar' }, { status: 400 })
  }

  if (Object.keys(updates).length) {
    const { error } = await admin.from('usuarios').update(updates).eq('id', id)
    if (error) return falloSeguro(error, 'update_profile', 'No se pudo actualizar el perfil.')
  }
  return json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, 20, 60_000, 'usuarios')) {
    return json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' }, { status: 429 })
  }

  const current = await getCurrentUser(request, request.signal)
  if (!current) {
    return json({ error: 'No autorizado' }, { status: 401 })
  }
  if (current.rol !== 'admin') {
    return json({ error: 'Solo administradores' }, { status: 403 })
  }

  const body = await parseBody(request)
  const id = body?.id || new URL(request.url).searchParams.get('id')
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json({ error: 'id inválido' }, { status: 400 })

  const admin = createServiceClient()
  if (!admin) {
    return json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const { data: userRow, error: fetchError } = await admin.from('usuarios').select('auth_id').eq('id', id).maybeSingle()
  if (fetchError || !userRow) {
    return json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (current.auth_id === userRow.auth_id) {
    return json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
  }

  // Verificar que no sea el último admin activo
  const { data: userToDelete } = await admin.from('usuarios').select('rol').eq('id', id).maybeSingle()
  if (userToDelete?.rol === 'admin') {
    const { count } = await admin.from('usuarios').select('id', { count: 'exact', head: true }).eq('rol', 'admin').eq('estado', 'activo')
    if ((count ?? 0) <= 1) {
      return json({ error: 'No se puede eliminar el último administrador activo del sistema' }, { status: 409 })
    }
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userRow.auth_id)
  if (authDeleteError) {
    return falloSeguro(authDeleteError, 'delete_auth', 'No se pudo eliminar la cuenta.', 400)
  }

  const { error: deleteError } = await admin.from('usuarios').delete().eq('id', id)
  if (deleteError) {
    return falloSeguro(deleteError, 'delete_profile', 'No se pudo eliminar el perfil.', 500)
  }

  return json({ ok: true })
}
