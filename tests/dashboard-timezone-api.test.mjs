import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

function preparar(rol = 'admin') {
  let guardada = null
  let lecturas = 0
  const consulta = {
    select() { return consulta },
    eq() { return consulta },
    maybeSingle() { lecturas++; return Promise.resolve({ data: guardada ? { valor: guardada } : null, error: null }) },
    upsert(fila) { guardada = fila.valor; return consulta },
    single() { return Promise.resolve({ data: { valor: guardada }, error: null }) },
  }
  const modulo = loadModule('app/api/configuracion/zona-horaria/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    '@/lib/server/auth': { getCurrentUser: async () => rol ? { rol } : null },
    '@/lib/server/supabase-admin': { createServiceClient: () => ({ from: () => consulta }) },
  })
  const request = (body) => ({ signal: undefined, json: async () => body })
  return { ...modulo, request, get lecturas() { return lecturas } }
}

test('solo devuelve la zona horaria y usa Costa Rica si la clave aún no existe', async () => {
  const api = preparar('colaborador')
  const respuesta = await api.GET(api.request())
  assert.equal(respuesta.status, 200)
  assert.equal(respuesta.body.zonaHoraria, 'America/Costa_Rica')
  assert.deepEqual(Object.keys(respuesta.body), ['zonaHoraria'])
})

test('solo el administrador guarda una zona válida', async () => {
  const colaborador = preparar('colaborador')
  assert.equal((await colaborador.PUT(colaborador.request({ zonaHoraria: 'America/Panama' }))).status, 403)
  const anonimo = preparar(null)
  assert.equal((await anonimo.GET(anonimo.request())).status, 401)
  const admin = preparar('admin')
  assert.equal((await admin.PUT(admin.request({ zonaHoraria: 'Zona/Falsa' }))).status, 400)
  assert.equal((await admin.PUT(admin.request({ zonaHoraria: 'America/Costa_Rica' }))).status, 200)
  assert.equal((await admin.GET(admin.request())).body.zonaHoraria, 'America/Costa_Rica')
})
