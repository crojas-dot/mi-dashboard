import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadModule } from './load-module.mjs'

const { puedeDerivarEnRevisionGC } = loadModule('lib/utils/quejaSacp.ts')

test('solo Calidad puede iniciar derivación desde revisión con propuesta registrada', () => {
  assert.equal(puedeDerivarEnRevisionGC('Pendiente de Revisión GC', null, 'Propuesta'), true)
  for (const estado of ['Recibido', 'En Investigación', 'Resuelto', 'Finalizado', 'No Procede']) {
    assert.equal(puedeDerivarEnRevisionGC(estado, null, 'Propuesta'), false, estado)
  }
  assert.equal(puedeDerivarEnRevisionGC('Pendiente de Revisión GC', 'sacp-existente', 'Propuesta'), false)
  assert.equal(puedeDerivarEnRevisionGC('Pendiente de Revisión GC', null, '   '), false)
  assert.equal(puedeDerivarEnRevisionGC('Pendiente de Revisión GC', null, null), false)
})

test('la migración conserva permisos y habilita GC sin borrar la protección de derivación previa', () => {
  const sql = readFileSync('supabase/migrations/20261113221000_quejas_sacp_revision_gc.sql', 'utf8')
  assert.match(sql, /qms_audit_sacp_permissions_v1/)
  assert.match(sql, /Pendiente de Revisión GC/)
  assert.match(sql, /v_queja\.derivado_sacp_id IS NOT NULL/)
})
