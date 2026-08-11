import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server/supabase-admin'
import { getCurrentUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

function parseBody(request: NextRequest) {
  return request.json().catch(() => null)
}

export async function GET(request: NextRequest) {
  const current = await getCurrentUser(request)
  if (!current) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!['admin', 'calidad'].includes(current.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const rol = searchParams.get('rol') || ''
  const estado = searchParams.get('estado') || ''

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  let query = admin.from('usuarios').select('id, email, nombre, rol, estado, auth_id, ultimo_acceso').order('nombre')

  if (search.trim()) {
    query = query.or(`nombre.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (rol) {
    query = query.eq('rol', rol)
  }
  if (estado) {
    query = query.eq('estado', estado)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const current = await getCurrentUser(request)
  if (!current) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (current.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  const body = await parseBody(request)
  if (!body) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const nombre = (body.nombre || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const rol = body.rol === 'admin' ? 'admin' : 'calidad'
  const estado = body.estado === 'inactivo' ? 'inactivo' : 'activo'
  const tempPassword =
    typeof body.password === 'string' && body.password.length >= 8 ? body.password : crypto.randomUUID().slice(0, 16)

  if (!nombre || !email || !rol) {
    return NextResponse.json({ error: 'Nombre, email y rol son obligatorios' }, { status: 400 })
  }

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { nombre },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
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
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: newUserId, tempPassword: tempPassword }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const current = await getCurrentUser(request)
  if (!current) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (current.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  const body = await parseBody(request)
  if (!body) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { id, nombre, rol, estado, email, newPassword } = body as {
    id?: string
    nombre?: string
    rol?: string
    estado?: string
    email?: string
    newPassword?: string
  }

  if (!id) {
    return NextResponse.json({ error: 'id obligatorio' }, { status: 400 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const { data: userRow, error: fetchError } = await admin.from('usuarios').select('auth_id').eq('id', id).maybeSingle()
  if (fetchError || !userRow) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  const authId = userRow.auth_id

  if (current.auth_id === authId) {
    if (estado !== undefined && estado === 'inactivo') {
      return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }
    if (rol !== undefined && rol !== 'admin') {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
    }
  }

  const updates: Record<string, unknown> = {}

  if (nombre !== undefined) {
    updates.nombre = nombre.trim()
  }
  if (rol !== undefined) {
    updates.rol = rol === 'admin' ? 'admin' : 'calidad'
  }
  if (estado !== undefined) {
    updates.estado = estado === 'inactivo' ? 'inactivo' : 'activo'
  }
  if (email !== undefined) {
    const newEmail = email.trim().toLowerCase()
    if (!newEmail.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    const { error: emailError } = await admin.auth.admin.updateUserById(authId, { email: newEmail })
    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 400 })
    }
    updates.email = newEmail
  }
  if (newPassword !== undefined) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }
    const { error: pwError } = await admin.auth.admin.updateUserById(authId, { password: newPassword })
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 400 })
    }
  }

  if (Object.keys(updates).length === 0 && newPassword === undefined) {
    return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
  }

  const { error } = await admin.from('usuarios').update(updates).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const current = await getCurrentUser(request)
  if (!current) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (current.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  const body = await parseBody(request)
  const id = body?.id || new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id obligatorio' }, { status: 400 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  const { data: userRow, error: fetchError } = await admin.from('usuarios').select('auth_id').eq('id', id).maybeSingle()
  if (fetchError || !userRow) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (current.auth_id === userRow.auth_id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userRow.auth_id)
  if (authDeleteError) {
    return NextResponse.json({ error: authDeleteError.message }, { status: 400 })
  }

  const { error: deleteError } = await admin.from('usuarios').delete().eq('id', id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
