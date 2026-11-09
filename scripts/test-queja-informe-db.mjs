// Base efímera con datos ficticios; no carga .env ni conecta a Supabase.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'

const root = process.cwd(), bin = process.env.QMS_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const work = path.join(root, '.performance', 'informe-db-' + Date.now()), data = path.join(work, 'data'), port = 55456
const { Pool } = createRequire(path.join(root, '.performance/load-tools/package.json'))('pg')
const password = randomBytes(32).toString('hex')
let pool, started = false, checks = 0
function run(binary, args) { const result = spawnSync(path.join(bin, binary), args, { encoding: 'utf8', stdio: 'ignore', windowsHide: true, timeout: 60000 }); if (result.status !== 0) throw Error('Falló PostgreSQL efímero: ' + binary) }
async function asRole(role, sql, args = []) {
  const client = await pool.connect()
  try { await client.query('SET ROLE ' + role); return await client.query(sql, args) }
  finally { await client.query('RESET ROLE'); client.release() }
}
async function denied(role, sql, args = [], code = '42501') { await assert.rejects(asRole(role, sql, args), error => error.code === code); checks++ }
try {
  fs.mkdirSync(work, { recursive: true }); const pw = path.join(work, 'pw'); fs.writeFileSync(pw, password)
  run('initdb.exe', ['-D', data, '-U', 'informe_fixture', '-A', 'scram-sha-256', '--pwfile=' + pw, '--encoding=UTF8', '--locale=C']); fs.unlinkSync(pw)
  run('pg_ctl.exe', ['-D', data, '-l', path.join(work, 'postgres.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start']); started = true
  pool = new Pool({ host: '127.0.0.1', port, user: 'informe_fixture', password, database: 'postgres', statement_timeout: 10000 })
  await pool.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    CREATE TABLE public.quejas(id uuid PRIMARY KEY, revision bigint NOT NULL, estado text NOT NULL);
    CREATE TABLE public.usuarios(id uuid PRIMARY KEY);`)
  await pool.query(fs.readFileSync('supabase/migrations/20261104001552_queja_informes_editables.sql', 'utf8'))
  const id = randomUUID(), actor = randomUUID()
  await pool.query("INSERT INTO quejas VALUES($1,7,'Pendiente de Revisión GC')", [id]); await pool.query('INSERT INTO usuarios VALUES($1)', [actor])
  const insert = 'INSERT INTO queja_informes(queja_id,version,contenido,fuente_revision,creado_por) VALUES($1,$2,$3,7,$4) RETURNING *'
  for (const role of ['anon', 'authenticated']) {
    await denied(role, 'SELECT * FROM queja_informes')
    await denied(role, insert, [id, 1, 'Informe ficticio', actor])
    for (const sql of ["UPDATE queja_informes SET contenido='alterado'", 'DELETE FROM queja_informes', 'TRUNCATE queja_informes']) await denied(role, sql)
  }
  const results = await Promise.allSettled([asRole('service_role', insert, [id, 1, 'Autor uno', actor]), asRole('service_role', insert, [id, 1, 'Autor dos', actor])])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); checks++
  assert.equal(results.find(result => result.status === 'rejected').reason.code, '23505'); checks++
  await asRole('service_role', insert, [id, 2, 'Edición conservada', actor])
  assert.equal((await asRole('service_role', 'SELECT * FROM queja_informes')).rowCount, 2); checks++
  for (const sql of ["UPDATE queja_informes SET contenido='alterado'", 'DELETE FROM queja_informes', 'TRUNCATE queja_informes']) await denied('service_role', sql)
  for (const [version, text] of [[0, 'x'], [3, ''], [3, 'x'.repeat(100001)]]) await denied('service_role', insert, [id, version, text, actor], '23514')
  await denied('service_role', insert, [randomUUID(), 3, 'Sin expediente', actor], '23503')
  await denied('service_role', insert, [id, 3, 'Sin autor', randomUUID()], '23503')
  const entity = (await pool.query('SELECT revision,estado FROM quejas WHERE id=$1', [id])).rows[0]
  assert.deepEqual(entity, { revision: '7', estado: 'Pendiente de Revisión GC' }); checks++
  const rls = (await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.queja_informes'::regclass")).rows[0]
  assert.equal(rls.relrowsecurity, true); checks++
  console.log(JSON.stringify({ ok: true, checks, isolated: true, remoteApplied: false }))
} finally { if (pool) await pool.end(); if (started) run('pg_ctl.exe', ['-D', data, '-m', 'fast', '-w', 'stop']) }
