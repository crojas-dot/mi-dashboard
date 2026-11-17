// PostgreSQL nuevo en loopback. Usa exclusivamente identidades y archivos ficticios.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'

const bin = process.env.QMS_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const dir = path.join(process.cwd(), '.performance', `perfiles-carga-db-${Date.now()}`)
const data = path.join(dir, 'pgdata'), port = 55479
const { Pool } = createRequire(path.join(process.cwd(), '.performance/load-tools/package.json'))('pg')
const password = randomBytes(32).toString('hex')
let pool, started = false, checks = 0

function run(command, args) {
  const result = spawnSync(path.join(bin, command), args, { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  if (result.status !== 0) throw new Error(result.error?.message ?? result.stderr.slice(-1000))
}

function check(actual, expected) {
  assert.deepEqual(actual, expected)
  checks++
}

const author = randomUUID(), caseId = randomUUID()
const scenarios = [
  { name: 'adjunto', sql: 'select id from queja_adjuntos where storage_path=$1 limit 1', params: i => ['fixture-' + (59_000 + i % 800)] },
  { name: 'campana', sql: 'select id,fecha from notificaciones where usuario_id=$1 and archivada=false order by fecha desc,id desc limit 15', params: () => [author] },
]

async function measure() {
  const report = {}
  for (const scenario of scenarios) {
    for (let i = 0; i < 8; i++) await pool.query(scenario.sql, scenario.params(i))
    const timing = []
    const queryCount = 192, workers = 24
    await Promise.all(Array.from({ length: workers }, async (_, worker) => {
      for (let i = worker; i < queryCount; i += workers) {
        const start = performance.now()
        const result = await pool.query(scenario.sql, scenario.params(i))
        assert.equal(result.rowCount, scenario.name === 'adjunto' ? 1 : 15)
        timing.push(performance.now() - start)
      }
    }))
    timing.sort((a, b) => a - b)
    const { rows } = await pool.query('explain (format json, analyze, buffers) ' + scenario.sql, scenario.params(0))
    const plan = rows[0]['QUERY PLAN'][0].Plan
    report[scenario.name] = {
      operations: queryCount, concurrent: workers,
      p95_ms: +timing[Math.ceil(.95 * timing.length) - 1].toFixed(2),
      plan: plan.Plans?.map(node => node['Node Type']).join(', ') ?? plan['Node Type'],
      buffers: plan['Shared Hit Blocks'] + plan['Shared Read Blocks'],
    }
  }
  return report
}

try {
  fs.mkdirSync(dir, { recursive: true })
  const pw = path.join(dir, 'pw')
  fs.writeFileSync(pw, password)
  run('initdb.exe', ['-D', data, '-U', 'fixture', '-A', 'scram-sha-256', '--pwfile=' + pw, '--encoding=UTF8', '--locale=C'])
  fs.unlinkSync(pw)
  run('pg_ctl.exe', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start'])
  started = true
  pool = new Pool({ host: '127.0.0.1', port, user: 'fixture', password, database: 'postgres', max: 24, statement_timeout: 20_000 })
  await pool.query(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema qms_private; create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table public.usuarios(id uuid primary key,avatar_url text);
    grant select, update(avatar_url) on usuarios to authenticated;
    grant all on usuarios to service_role;
    create function public.app_usuario_actual_id() returns uuid language sql stable as
      $$ select nullif(current_setting('qms.fixture_actor',true),'')::uuid $$;
    create table public.quejas_actividad(id uuid default gen_random_uuid(),queja_id uuid,usuario_id uuid,tipo text,descripcion text,created_at timestamptz default now());
    alter table quejas_actividad enable row level security;
    grant select, insert on quejas_actividad to authenticated;
    grant all on quejas_actividad to service_role;
    create policy own_case_note on quejas_actividad for insert to authenticated with check
      (queja_id::text=current_setting('qms.fixture_case',true));
    create policy notes_read on quejas_actividad for select to authenticated using (usuario_id=app_usuario_actual_id());
    create table public.queja_adjuntos(id integer primary key,storage_path text not null);
    create table public.notificaciones(id integer primary key,usuario_id uuid not null,fecha timestamptz,archivada boolean not null);
    create index idx_notificaciones_usuario on notificaciones(usuario_id);
    insert into queja_adjuntos select i,'fixture-'||i from generate_series(1,60000) i;
  `)
  await pool.query(`insert into notificaciones
    select i, case when i%40=0 then $1::uuid else md5((i%400)::text)::uuid end,
      now()-make_interval(secs=>i), i%7<4 from generate_series(1,120000) i`, [author])
  await pool.query('analyze queja_adjuntos; analyze notificaciones')
  const before = await measure()
  const migration = fs.readdirSync('supabase/migrations').find(name => name.endsWith('_perfiles_avatar_privado_y_autoria_notas.sql'))
  assert.ok(migration)
  await pool.query(fs.readFileSync(path.join('supabase/migrations', migration), 'utf8'))
  const after = await measure()
  assert.ok(after.adjunto.buffers < before.adjunto.buffers)
  assert.ok(after.campana.buffers < before.campana.buffers)

  const { rows: [bucket] } = await pool.query('select public,file_size_limit,allowed_mime_types from storage.buckets where id=$1', ['qms-avatars'])
  check(bucket, { public: false, file_size_limit: '524288', allowed_mime_types: ['image/webp'] })
  const { rows: [acl] } = await pool.query(`select
    has_column_privilege('authenticated','public.usuarios','avatar_url','UPDATE') as client,
    has_column_privilege('service_role','public.usuarios','avatar_url','UPDATE') as server`)
  check(acl, { client: false, server: true })

  const connection = await pool.connect()
  try {
    await connection.query('set role authenticated')
    await connection.query("select set_config('qms.fixture_actor',$1,false), set_config('qms.fixture_case',$2,false)", [author, caseId])
    const { rows: [note] } = await connection.query("insert into quejas_actividad(queja_id,tipo,descripcion) values($1,'nota','Registro de prueba') returning usuario_id", [caseId])
    check(note.usuario_id, author)
    await assert.rejects(connection.query("insert into quejas_actividad(queja_id,tipo,descripcion) values($1,'nota','Sin asignación')", [randomUUID()]), { code: '42501' })
    checks++
    await connection.query('set role service_role')
    const { rows: [event] } = await connection.query("insert into quejas_actividad(queja_id,tipo,descripcion) values($1,'estado','Transición de prueba') returning usuario_id", [caseId])
    check(event.usuario_id, null)
  } finally {
    await connection.query('reset role')
    connection.release()
  }

  const result = { isolated: true, checks, rows: { adjuntos: 60_000, notificaciones: 120_000 }, before, after }
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} finally {
  if (pool) await pool.end()
  if (started) run('pg_ctl.exe', ['-D', data, '-w', 'stop', '-m', 'fast'])
}
