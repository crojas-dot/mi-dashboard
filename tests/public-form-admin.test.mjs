import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

function deletion(error) {
  const calls = []
  const client = { from: table => { calls.push(table); return { delete: () => ({ eq: async (key, id) => { calls.push([key, id]); return { error } } }) } } }
  const hooks = loadModule('lib/queries/useFormulariosPublicos.ts', {
    '@/lib/supabase': { supabase: client },
    '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => ({ invalidateQueries: () => calls.push('invalidate') }) },
  })
  return { operation: hooks.useEliminarFormularioPublico(), calls }
}

test('enlace con envíos conserva el error de negocio y propone desactivar sin exponer SQL', async () => {
  const f = deletion({ code: '23503', message: 'private SQL fixture', details: 'private ledger fixture' })
  await assert.rejects(f.operation.mutationFn('synthetic-id'), error => /Desactivalo/.test(error.message) && !/private/.test(error.message))
  assert.equal(f.calls.includes('invalidate'), false)
})

test('eliminación sin envíos y otros errores conservan el contrato de mutación', async () => {
  const success = deletion(null)
  await success.operation.mutationFn('synthetic-id'); success.operation.onSuccess()
  assert.equal(success.calls.at(-1), 'invalidate')
  assert.deepEqual(Array.from(success.calls[1]), ['id', 'synthetic-id'])
  const denied = { code: '42501', message: 'Not allowed' }
  await assert.rejects(deletion(denied).operation.mutationFn('synthetic-id'), error => error === denied)
})
