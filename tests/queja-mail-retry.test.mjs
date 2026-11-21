import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadModule } from './load-module.mjs'

const caseId = randomUUID()
const eventId = randomUUID()
const url = new URL(`https://qms.example.test/api/quejas/correos/reintentar?quejaId=${caseId}&eventId=${eventId}`)
const timestamp = '2026-11-20T18:00:00Z'

function fixture({ role = 'admin', authorized = true, caseVisible = true, changed = false, status = 'retry', code = 'authorization_permission_denied', attempts = 3 } = {}) {
  const calls = []
  const mail = { status, safe_error: code, attempts, sent_at: status === 'sent' ? timestamp : null, updated_at: timestamp }
  const table = (tables, admin = false) => ({
    from(tableName) {
      const call = { tableName, admin, filters: [] }
      calls.push(call)
      return {
        select() { return this },
        update(body) { call.body = body; return this },
        eq(column, value) { call.filters.push([column, value]); return this },
        is(column, value) { call.filters.push([column, value]); return this },
        async maybeSingle() { return { data: tables[tableName], error: null } },
      }
    },
    async rpc(name, args) {
      calls.push({ name, args })
      return { data: authorized, error: null }
    },
  })
  const route = loadModule('app/api/quejas/correos/reintentar/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/server/auth': {
      getCurrentUser: async request => request.headers.get('authorization') === 'Bearer valid' && role ? { id: randomUUID(), rol: role } : null,
      createAuthenticatedClient: () => table({ quejas: caseVisible ? { id: caseId } : null, queja_mail_outbox: mail }),
    },
    '@/lib/server/rateLimit': { rateLimit: () => true },
    '@/lib/server/supabase-admin': { createServiceClient: () => table({ queja_mail_outbox: changed ? null : { id: eventId } }, true) },
  })
  return { calls, run: (token = 'valid') => route.POST({ nextUrl: url, headers: new Headers({ authorization: `Bearer ${token}` }) }) }
}

test('reintentar exige un token válido, autorización de escritura y un expediente visible', async () => {
  const invalid = fixture()
  assert.equal((await invalid.run('invalid')).status, 401)
  for (const [opts, status] of [[{ role: 'colaborador' }, 403], [{ role: 'calidad', authorized: false }, 403], [{ caseVisible: false }, 404]]) {
    const f = fixture(opts)
    assert.equal((await f.run()).status, status)
    assert.equal(f.calls.some(call => call.admin), false)
  }
})

test('reintenta en la misma fila y protege el cambio concurrente del worker', async () => {
  for (const status of ['retry', 'failed']) {
    const f = fixture({ status, code: status === 'failed' ? 'attempt_limit' : undefined })
    assert.deepEqual(await (await f.run()).json(), { queued: true })
    const write = f.calls.find(call => call.admin)
    assert.equal(write.body.status, 'pending')
    assert.equal(write.body.attempts, status === 'failed' ? 0 : undefined)
    assert.deepEqual(write.filters, [['queja_id', caseId], ['id', eventId], ['status', status], ['updated_at', timestamp], ['sent_at', null], ['claim_token', null], ['lease_until', null]])
    assert.equal(Object.hasOwn(write.body, 'destinatario'), false)
  }
  assert.equal((await fixture({ changed: true }).run()).status, 409)
})

test('enviados, inciertos, con reserva activa y conflictos de entrega no se reprograman', async () => {
  for (const [status, code] of [['sent', null], ['uncertain', 'delivery_uncertain'], ['leased', null], ['failed', 'event_conflict']]) {
    const f = fixture({ status, code })
    assert.equal((await f.run()).status, 409)
    assert.equal(f.calls.some(call => call.admin), false)
  }
})
