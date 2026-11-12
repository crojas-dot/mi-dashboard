// PostgreSQL temporal y datos sintéticos; nunca carga .env ni conecta a ECA-QMS.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const root = process.cwd(), bin = process.env.QMS_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const work = path.join(root, '.performance', 'investigation-notes-db-' + Date.now()), data = path.join(work, 'data'), port = 55469
const { Pool } = createRequire(path.join(root, '.performance/load-tools/package.json'))('pg')
const password = randomBytes(32).toString('hex'), migration = fs.readdirSync('supabase/migrations').find(name => name.endsWith('_quejas_notas_investigacion.sql'))
let pool, started = false, checks = 0
const check = (a, b) => { assert.deepEqual(a, b); checks++ }
const run = (exe, args) => { const r = spawnSync(path.join(bin, exe), args, { encoding: 'utf8', windowsHide: true, timeout: 60000 }); if (r.status !== 0) throw new Error((r.error?.message ?? r.stderr ?? 'PostgreSQL temporal no disponible').slice(-900)) }
const own = { id: randomUUID(), auth: randomUUID() }, other = { id: randomUUID(), auth: randomUUID() }, admin = { id: randomUUID(), auth: randomUUID() }, quality = { id: randomUUID(), auth: randomUUID() }, inactive = { id: randomUUID(), auth: randomUUID() }, denied = { id: randomUUID(), auth: randomUUID() }, reader = { id: randomUUID(), auth: randomUUID() }
const id = randomUUID(), ownNote = randomUUID(), otherNote = randomUUID(), joinNote = randomUUID(), returnNote = randomUUID(), approvedNote = randomUUID()
const TEXT = 'Avance de la investigación'
async function as(actor, sql, args = [], role = 'authenticated') {
  const c = await pool.connect()
  try { await c.query('SET ROLE ' + role); await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor?.auth ?? '']); return (await c.query(sql, args)).rows }
  finally { await c.query('RESET ROLE'); c.release() }
}
const edit = (actor, note, content, expected = TEXT) => as(actor, 'select qms_update_investigation_note($1,$2,$3,$4) as note', [id, note, expected, content]).then(r => r[0].note)
const remove = (actor, note, expected = TEXT) => as(actor, 'select qms_delete_investigation_note($1,$2,$3) as note', [id, note, expected]).then(r => r[0].note)
const rejected = async (promise, code) => { await assert.rejects(promise, e => e.code === code); checks++ }
const description = async note => (await pool.query('select descripcion from quejas_actividad where id=$1', [note])).rows[0]?.descripcion
try {
  fs.mkdirSync(work, { recursive: true }); const pw = path.join(work, 'pw'); fs.writeFileSync(pw, password)
  run('initdb.exe', ['-D', data, '-U', 'fixture', '-A', 'scram-sha-256', '--pwfile=' + pw, '--encoding=UTF8', '--locale=C']); fs.unlinkSync(pw)
  run('pg_ctl.exe', ['-D', data, '-l', path.join(work, 'postgres.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start']); started = true
  pool = new Pool({ host: '127.0.0.1', port, user: 'fixture', password, database: 'postgres', max: 4 })
  await pool.query(`create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth; create schema qms_private;
    grant usage on schema auth,public to authenticated,anon;
    grant usage on schema qms_private to authenticated;
    create table usuarios(id uuid primary key,auth_id uuid unique,rol text,estado text);
    create table permisos(rol text,modulo text,leer boolean,escribir boolean);
    create table quejas(id uuid primary key,estado text,responsable_id uuid);
    create table quejas_actividad(id uuid primary key default gen_random_uuid(),queja_id uuid not null references quejas(id),tipo text not null default 'nota',descripcion text not null,usuario_id uuid,created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function app_usuario_actual_id() returns uuid language sql stable security definer set search_path='' as $$select id from public.usuarios where auth_id=auth.uid() and estado='activo'$$;
    create function app_es_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol='admin')$$;
    create function app_es_staff() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol in ('admin','calidad'))$$;
    create function app_es_colaborador() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol='colaborador')$$;
    create function app_tiene_permiso(module text,write boolean default false) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.permisos p join public.usuarios u on u.rol=p.rol where u.auth_id=auth.uid() and u.estado='activo' and p.modulo=module and p.leer and (not write or p.escribir))$$;
    alter table quejas_actividad enable row level security;
    grant select on quejas to authenticated;
    grant select,insert,update,delete on quejas_actividad to authenticated;
    create policy notes_read on quejas_actividad for select to authenticated using(app_es_admin() or app_es_staff() and app_tiene_permiso('quejas') or app_es_colaborador() and app_tiene_permiso('mis_quejas') and exists(select 1 from quejas q where q.id=queja_id and q.responsable_id=app_usuario_actual_id()));
    create policy notes_insert on quejas_actividad for insert to authenticated with check(app_tiene_permiso('quejas',true) or app_tiene_permiso('mis_quejas',true));`)
  for (const [actor, rol, estado] of [[own, 'colaborador', 'activo'], [other, 'colaborador', 'activo'], [admin, 'admin', 'activo'], [quality, 'calidad', 'activo'], [inactive, 'admin', 'inactivo'], [denied, 'calidad_sin_permiso', 'activo'], [reader, 'lector_sin_permiso', 'activo']]) await pool.query('insert into usuarios values($1,$2,$3,$4)', [actor.id, actor.auth, rol, estado])
  await pool.query("insert into permisos values('colaborador','mis_quejas',true,true),('calidad','quejas',true,true),('calidad_sin_permiso','quejas',true,false),('lector_sin_permiso','mis_quejas',true,false)")
  await pool.query("insert into quejas values($1,'En Investigación',$2)", [id, own.id])
  await pool.query("insert into quejas_actividad(id,queja_id,tipo,descripcion,usuario_id) values($1,$5,'nota',$6,$7),($2,$5,'nota','Nota de otra persona',$8),($3,$5,'nota','Concatenación del trámite',null),($4,$5,'nota','Devuelta a investigación. Motivo: Falta análisis',$9)",
    [ownNote, otherNote, joinNote, returnNote, id, TEXT, own.id, other.id, quality.id])
  await pool.query("insert into quejas_actividad(id,queja_id,tipo,descripcion,usuario_id) values($1,$3,'nota','Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.',$4),($2,$3,'nota','Respuesta al cliente y oficio oficial publicados. Expediente finalizado.',$4)", [approvedNote, randomUUID(), id, quality.id])
  const before = (await pool.query('select * from quejas_actividad where id=$1', [ownNote])).rows[0]
  await pool.query(fs.readFileSync(path.join('supabase/migrations', migration), 'utf8'))

  const edited = await edit(own, ownNote, '  Avance corregido  ')
  check(edited.descripcion, 'Avance corregido'); check(edited.usuario_id, own.id)
  check((await pool.query('select created_at from quejas_actividad where id=$1', [ownNote])).rows[0].created_at.getTime(), before.created_at.getTime())
  check(await description(ownNote), 'Avance corregido')
  check((await pool.query('select estado from quejas where id=$1', [id])).rows[0].estado, 'En Investigación')

  for (const actor of [other, admin, quality, inactive, denied, reader, null]) await rejected(() => edit(actor, ownNote, 'Intento ajeno', 'Avance corregido'), '42501')
  await rejected(() => edit(own, otherNote, 'Reescritura', 'Nota de otra persona'), '42501')
  await rejected(() => edit(own, joinNote, 'Reescritura', 'Concatenación del trámite'), '42501')
  await rejected(() => edit(own, returnNote, 'Reescritura', 'Devuelta a investigación. Motivo: Falta análisis'), '42501')
  await rejected(() => edit(own, approvedNote, 'Reescritura', 'Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.'), '42501')
  await rejected(() => edit(own, randomUUID(), 'Texto', 'Avance corregido'), 'P0002')
  await rejected(() => edit(own, ownNote, 'Texto', 'Otra versión'), '40001')
  await rejected(() => edit(own, ownNote, 'Texto', null), '40001')
  await rejected(() => edit(own, ownNote, '', 'Avance corregido'), '22023')
  await rejected(() => edit(own, ownNote, '   ', 'Avance corregido'), '22023')
  await rejected(() => edit(own, ownNote, 'x'.repeat(10001), 'Avance corregido'), '22023')
  await rejected(() => edit(own, ownNote, 'Devuelta a investigación. Motivo: falso', 'Avance corregido'), '22023')
  await rejected(() => edit(own, ownNote, 'Resolución aprobada por Gestión de Calidad. Pendiente de respuesta al cliente.', 'Avance corregido'), '22023')
  check(await description(ownNote), 'Avance corregido')

  for (const estado of ['Recibido', 'Pendiente de Revisión GC', 'Resuelto', 'Finalizado', 'No Procede', null]) {
    await pool.query('update quejas set estado=$2 where id=$1', [id, estado])
    await rejected(() => edit(admin, ownNote, 'Texto', 'Avance corregido'), '55000')
    await rejected(() => remove(admin, ownNote, 'Avance corregido'), '55000')
  }
  await pool.query("update quejas set estado='En Investigación',responsable_id=$2 where id=$1", [id, other.id])
  await rejected(() => edit(own, ownNote, 'Texto', 'Avance corregido'), '42501')
  await rejected(() => remove(own, ownNote, 'Avance corregido'), '42501')
  await pool.query('update quejas set responsable_id=$2 where id=$1', [id, own.id])

  // RLS solo expone lectura/alta: la escritura directa no altera el historial.
  await as(own, 'update quejas_actividad set descripcion=$2 where id=$1', [ownNote, 'Bypass'])
  check(await description(ownNote), 'Avance corregido')
  await as(own, 'delete from quejas_actividad where id=$1', [ownNote])
  check(await description(ownNote), 'Avance corregido')

  await rejected(() => remove(own, ownNote, 'Versión vieja'), '40001')
  const removed = await remove(own, ownNote, 'Avance corregido')
  check(removed.descripcion, 'Avance corregido')
  check(await description(ownNote), undefined)
  await rejected(() => remove(own, otherNote, 'Nota de otra persona'), '42501')
  await rejected(() => remove(admin, joinNote, 'Concatenación del trámite'), '42501')
  await rejected(() => remove(own, returnNote, 'Devuelta a investigación. Motivo: Falta análisis'), '42501')
  await rejected(() => remove(own, randomUUID(), 'Texto'), 'P0002')

  await rejected(() => as(null, 'select qms_update_investigation_note($1,$2,$3,$4)', [id, otherNote, 'Nota de otra persona', 'Texto'], 'anon'), '42501')
  await rejected(() => as(null, 'select qms_delete_investigation_note($1,$2,$3)', [id, otherNote, 'Nota de otra persona'], 'anon'), '42501')
  check((await pool.query("select has_function_privilege('anon','public.qms_update_investigation_note(uuid,uuid,text,text)','execute') as allowed")).rows[0].allowed, false)
  check((await pool.query("select has_function_privilege('anon','public.qms_delete_investigation_note(uuid,uuid,text)','execute') as allowed")).rows[0].allowed, false)
  check((await pool.query("select bool_and(not prosecdef) as invoker from pg_proc where oid in ('public.qms_update_investigation_note(uuid,uuid,text,text)'::regprocedure,'public.qms_delete_investigation_note(uuid,uuid,text)'::regprocedure)")).rows[0].invoker, true)
  check((await pool.query("select bool_and(prosecdef) as definer from pg_proc where proname in ('update_investigation_note','delete_investigation_note') and pronamespace='qms_private'::regnamespace")).rows[0].definer, true)
  check((await pool.query("select bool_and(proconfig::text like '%search_path%') as fixed from pg_proc where proname in ('update_investigation_note','delete_investigation_note') and pronamespace='qms_private'::regnamespace")).rows[0].fixed, true)

  const evidence = { checks, migration, remoteBusinessWrites: 0, coverage: ['RLS y grants', 'identidad operativa distinta de Auth', 'autor propio y responsable vigente', 'notas de workflow protegidas', 'CAS de contenido', 'límite y contenido inválido', 'estados no editables', 'reescritura directa bloqueada', 'edición y borrado', 'envoltorios invoker'] }
  fs.writeFileSync(path.join(work, 'evidence.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence))
} finally { if (pool) await pool.end(); if (started) run('pg_ctl.exe', ['-D', data, '-m', 'immediate', '-w', 'stop']) }
