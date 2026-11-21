import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const origin = 'https://qms.example.test'
const actor = { id: randomUUID(), sessionId: randomUUID(), aal: 'aal1' }
const otherId = randomUUID()
const env = { env: { NODE_ENV: 'production', PUBLIC_TRACKING_ORIGIN: origin } }

function makeAdmin(setup, mode) {
  const calls = []
  const admin = {
    rpc: async (rpc, args) => {
      calls.push({ type: 'rpc', rpc, action: args.p_action, data: args.p_data })
      if (args.p_action === 'create_begin') return { data: mode === 'invite'
        ? { completed: false, authId: null }
        : { id: setup.id, completed: false, authId: null, leaseUntil: new Date(Date.now() + 90_000).toISOString() } }
      if (args.p_action === 'create_commit') return { data: rpc === 'qms_temporary_access_command' ? { issued: true } : { authId: otherId } }
      if (args.p_action === 'invite') return { data: { email: 'new@example.test' } }
      return { data: {} }
    },
    auth: { admin: { createUser: async input => {
      calls.push({ type: 'auth', input })
      return { data: { user: { id: otherId } }, error: null }
    } } },
    functions: { invoke: async (name, { body }) => {
      calls.push({ type: 'mail', name, body })
      return { data: { outcome: 'sent' } }
    } },
  }
  return { admin, calls }
}

test('POST valida dos opciones independientes y exige siempre envío seguro por correo', () => {
  const { validarUsuarioInput } = loadModule('lib/server/usuarioInput.ts')
  const base = { nombre: 'Ana', email: 'ana@example.test', rol: 'colaborador', estado: 'activo' }
  for (const invite of [true, false]) for (const requireMfa of [true, false]) for (const sendByEmail of [true, false]) {
    if (invite && !sendByEmail) continue // La invitación legacy necesita correo para entregar el vínculo.
    const access = { id: randomUUID(), invite, requireMfa, sendByEmail }
    const value = validarUsuarioInput({ ...base, access }, 'POST')
    assert.equal(value.error, undefined)
    assert.equal(value.data.access.invite, invite)
    assert.equal(value.data.access.requireMfa, requireMfa)
    assert.equal(value.data.access.sendByEmail, sendByEmail)
  }
  for (const access of [
    { id: randomUUID(), invite: 'true', requireMfa: true, sendByEmail: true },
    { id: randomUUID(), invite: true, requireMfa: 'true', sendByEmail: true },
    { id: randomUUID(), invite: true, requireMfa: true, sendByEmail: 'no' },
    { id: randomUUID(), invite: true, requireMfa: true, sendByEmail: false },
  ]) assert.equal(validarUsuarioInput({ ...base, access }, 'POST').error, 'Configuración de acceso inválida')
})

test('invitación crea política elegida, genera enlace personal y no devuelve contraseña', async () => {
  const setup = { id: randomUUID(), invite: true, requireMfa: true, sendByEmail: true }
  const { admin, calls } = makeAdmin(setup, 'invite')
  const { createUserWithAccess } = loadModule('lib/server/accessService.ts', {}, { process: env })
  const result = await createUserWithAccess(admin, actor, { nombre: 'Ana', email: 'new@example.test', rol: 'colaborador', estado: 'activo' }, setup)
  assert.equal(result.accessDelivery, 'sent')
  assert.equal(result.invitation, 'sent')
  assert.equal(result.tempPassword, undefined)
  const create = calls.find(x => x.action === 'create_begin')
  assert.equal(create.rpc, 'qms_access_command')
  assert.equal(create.data.invite, true)
  assert.equal(create.data.requireMfa, true)
  const mail = calls.find(x => x.type === 'mail')
  assert.equal(mail.body.kind, 'invitation')
  assert.equal(mail.body.to, 'new@example.test')
  assert.match(mail.body.url, /^https:\/\/qms\.example\.test\/acceso#invitacion=[A-Za-z0-9_-]{43}$/)
  assert.equal('password' in mail.body, false)
  assert.ok(calls.find(x => x.action === 'invite_result'))
  assert.equal(calls.some(x => x.rpc === 'qms_temporary_access_command'), false)
})

test('sin invitación, elige 2FA libremente y no expone la contraseña temporal en el API', async () => {
  const setup = { id: randomUUID(), invite: false, requireMfa: true, sendByEmail: true }
  const { admin, calls } = makeAdmin(setup, 'temporary')
  const { createUserWithAccess } = loadModule('lib/server/accessService.ts', {}, { process: env })
  const result = await createUserWithAccess(admin, actor, { nombre: 'Ana', email: 'new@example.test', rol: 'colaborador', estado: 'activo' }, setup)
  assert.equal(result.accessDelivery, 'sent')
  assert.equal(result.tempPassword, undefined)
  const create = calls.find(x => x.action === 'create_begin')
  assert.equal(create.rpc, 'qms_temporary_access_command')
  assert.equal(create.data.requireMfa, true)
  assert.equal(create.data.invite, false)
  const mail = calls.find(x => x.type === 'mail')
  assert.equal(mail.body.kind, 'temporary_access')
  assert.equal(mail.body.url, origin + '/login')
  assert.equal(mail.body.password, calls.find(x => x.type === 'auth').input.password)
  assert.equal(calls.some(x => x.action === 'invite'), false)
})

test('sin correo el administrador recibe la clave una única vez y el proveedor no se invoca', async () => {
  const setup = { id: randomUUID(), invite: false, requireMfa: false, sendByEmail: false }
  const { admin, calls } = makeAdmin(setup, 'temporary')
  const { createUserWithAccess } = loadModule('lib/server/accessService.ts', {}, { process: env })
  const first = await createUserWithAccess(admin, actor, {
    nombre: 'Persona sintética', email: 'new@example.test', rol: 'colaborador', estado: 'activo',
  }, setup)
  assert.equal(first.accessDelivery, 'not_sent')
  assert.equal(typeof first.tempPassword, 'string')
  assert.equal(first.tempPassword.length, 24)
  assert.equal(calls.find(x => x.type === 'auth').input.password, first.tempPassword)
  assert.equal(calls.find(x => x.action === 'create_begin').data.sendByEmail, false)
  assert.equal(calls.some(x => x.type === 'mail'), false)
})

test('reenviar una invitación pendiente no restablece la contraseña del invitado', async () => {
  const calls = []
  const s = loadModule('lib/server/accessService.ts', {}, { process: env })
  const api = loadModule('app/api/usuarios/acceso/route.ts', {
    'next/server': { NextResponse: { json: (value, options = {}) => Response.json(value, options) } },
    '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'synthetic' },
    '@/lib/server/auth': { getCurrentUser: async () => ({ rol: 'admin' }) },
    '@/lib/server/accessIdentity': { getAccessIdentity: async () => actor },
    '@/lib/server/supabase-admin': { createServiceClient: () => ({}) },
    '@/lib/server/accessService': { ...s,
      accessDirectory: async () => [{ authId: otherId, status: 'invite_pending', requireMfa: true }],
      inviteAccess: async () => { calls.push('invite'); return { outcome: 'sent' } },
      resetUserAccess: async () => { calls.push('reset'); throw new Error('no debe cambiar contraseña') },
    },
  })
  const request = new Request(origin + '/api/usuarios/acceso', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'resend', authId: otherId, confirm: true }) })
  const response = await api.POST(request)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).invitation, 'sent')
  assert.deepEqual(calls, ['invite'])
})
