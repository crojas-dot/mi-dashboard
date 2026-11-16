// PostgreSQL temporal, sin .env, sesiones reales ni escrituras en ECA-QMS.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const root = process.cwd(), bin = process.env.QMS_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const work = path.join(root, '.performance', 'quejas-bandeja-db-' + Date.now()), data = path.join(work, 'data')
const { Pool } = createRequire(path.join(root, '.performance/load-tools/package.json'))('pg')
const password = randomBytes(32).toString('hex'), port = 55469
const contextOnly = process.argv.includes('--context-only')
const migrations = ['20261116161027_quejas_bandeja_actividad.sql', '20261116162000_quejas_bandeja_movimientos.sql']
let pool, started = false, checks = 0
const check = (a, b) => { assert.deepEqual(a, b); checks++ }
const run = (exe, args) => {
  const r = spawnSync(path.join(bin, exe), args, { encoding: 'utf8', windowsHide: true, timeout: 60000 })
  if (r.status !== 0) throw new Error((r.error?.message ?? r.stderr ?? 'PostgreSQL temporal no disponible').slice(-900))
}
const actors = Object.fromEntries(['own', 'other', 'admin', 'quality', 'inactive', 'denied'].map(key => [key, { id: randomUUID(), auth: randomUUID() }]))
async function as(actor, sql, args = [], role = 'authenticated') {
  const c = await pool.connect()
  try {
    await c.query('SET ROLE ' + role)
    await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor?.auth ?? ''])
    return (await c.query(sql, args)).rows
  } finally { await c.query('RESET ROLE'); c.release() }
}
const rejected = async fn => { await assert.rejects(fn, e => e.code === '42501'); checks++ }
const query = async (sql, args = []) => (await pool.query(sql, args)).rows
const context = async (ingreso, ultima, gestion, estado, hoy, calendar = 1) =>
  (await as(actors.own, 'select qms_private.complaint_activity_context($1,$2,$3,$4,$5,$6) as texto', [ingreso, ultima, gestion, estado, calendar, hoy]))[0].texto
const record = async (id, owner, fecha = '2000-01-01T12:00Z', estado = 'Recibido') => {
  await query('insert into quejas(id,folio,fecha,estado,responsable_id,revision) values($1,$2,$3,$4,$5,7)', [id, 'TEST-' + id.slice(-4), fecha, estado, owner])
}
const marker = async id => (await query('select ultima_actividad_relevante_at::text as marca, gestionada from queja_bandeja_actividad where queja_id=$1', [id]))[0]
const changed = async (id, sql, args = []) => {
  const before = await marker(id)
  await query(sql, args)
  const after = await marker(id)
  assert.ok(after.marca > before.marca); checks++
  check(after.gestionada, true)
}
const unchanged = async (id, sql, args = []) => {
  const before = await marker(id); await query(sql, args); check(await marker(id), before)
}
try {
  fs.mkdirSync(work, { recursive: true }); const pw = path.join(work, 'pw'); fs.writeFileSync(pw, password)
  run('initdb.exe', ['-D', data, '-U', 'fixture', '-A', 'scram-sha-256', '--pwfile=' + pw, '--encoding=UTF8', '--locale=C']); fs.unlinkSync(pw)
  run('pg_ctl.exe', ['-D', data, '-l', path.join(work, 'postgres.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start']); started = true
  pool = new Pool({ host: '127.0.0.1', port, user: 'fixture', password, database: 'postgres', max: 4 })
  await query(`create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth; create schema qms_private;
    grant usage on schema auth,public,qms_private to authenticated,anon,service_role;
    create table usuarios(id uuid primary key,auth_id uuid unique,rol text,estado text);
    create table permisos(rol text,modulo text,leer boolean);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function app_usuario_actual_id() returns uuid language sql stable security definer set search_path='' as $$select id from public.usuarios where auth_id=auth.uid() and estado='activo'$$;
    create function app_es_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol='admin')$$;
    create function app_es_staff() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol in ('admin','calidad'))$$;
    create function app_es_colaborador() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol='colaborador')$$;
    create function app_tiene_permiso(module text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.permisos p join public.usuarios u on u.rol=p.rol where u.auth_id=auth.uid() and u.estado='activo' and p.modulo=module and p.leer)$$;`)
  await query(fs.readFileSync('tests/fixtures/quejas-bandeja-schema.sql', 'utf8'))
  await query(`alter table quejas enable row level security;
    grant select on quejas,qms_quejas,qms_stage_runs,qms_calendars,catalogos to authenticated,service_role;
    create policy cases_read on quejas for select to authenticated using(app_es_admin() or app_es_staff() and app_tiene_permiso('quejas') or app_es_colaborador() and app_tiene_permiso('mis_quejas') and responsable_id=app_usuario_actual_id());
    alter table qms_stage_runs enable row level security;
    create policy runs_read on qms_stage_runs for select to authenticated using(exists(select 1 from quejas where id=case_id));
    alter table qms_calendars enable row level security;
    create policy calendar_read on qms_calendars for select to authenticated using((select auth.uid()) is not null);
    insert into qms_calendars(id,weekdays,holidays,timezone) values(1,array[1,2,3,4,5],'[]','America/Costa_Rica'),(2,array[1,2,3,4,5],'[{"date":"2026-11-16"}]','America/Costa_Rica');`)
  for (const [key, rol, estado] of [['own','colaborador','activo'],['other','colaborador','activo'],['admin','admin','activo'],['quality','calidad','activo'],['inactive','admin','inactivo'],['denied','calidad','activo']]) {
    await query('insert into usuarios values($1,$2,$3,$4)', [actors[key].id, actors[key].auth, rol, estado])
  }
  await query("insert into permisos values('colaborador','mis_quejas',true),('calidad','quejas',true)")
  await query(fs.readFileSync('supabase/migrations/' + migrations[0], 'utf8'))
  for (const [start, day, expected, calendar] of [
    ['2026-11-16','2026-11-16','Nuevo',1], ['2026-11-16','2026-11-17','Nuevo',1], ['2026-11-16','2026-11-18',null,1],
    ['2026-11-13','2026-11-16','Nuevo',1], ['2026-11-13','2026-11-17',null,1],
    ['2026-11-14','2026-11-17','Nuevo',1], ['2026-11-14','2026-11-18',null,1],
    ['2026-11-13','2026-11-17','Nuevo',2], ['2026-11-13','2026-11-18',null,2],
    ['2026-11-20','2026-11-16',null,1], ['2026-11-16','2026-11-16',null,null],
  ]) check(await context(start+'T12:00Z', null, false, 'Recibido', day, calendar), expected)
  for (const [last, expected] of [['2026-11-16T12:00Z','hoy'],['2026-11-16T02:00Z','ayer'],['2026-11-14T12:00Z','hace 2 días'],['2026-10-17T12:00Z','hace 30 días'],['2026-10-16T12:00Z','16/10/2026']]) {
    check(await context('2026-10-01T12:00Z', last, true, 'En Investigación', '2026-11-16'), 'Actualización: ' + expected)
  }
  for (const state of ['Resuelto','Finalizado','No Procede','Cerrado','Cerrada']) check(await context('2026-11-16T12:00Z',null,false,state,'2026-11-16'), null)
  if (!contextOnly) {
    const own = randomUUID(), other = randomUUID(), untouched = randomUUID()
    await record(own, actors.own.id); await record(other, actors.other.id); await record(untouched, null)
    await query("insert into quejas_actividad(id,queja_id,tipo,descripcion,created_at) values($1,$2,'nota','Nota histórica','2001-01-01T12:00Z')", [randomUUID(),own])
    await query(fs.readFileSync('supabase/migrations/' + migrations[1], 'utf8'))
    check((await marker(own)).marca, '2001-01-01 12:00:00+00')
    check((await marker(untouched)).gestionada, false)
    check((await marker(untouched)).marca, '2000-01-01 12:00:00+00')
    for (const [actor, expected] of [[actors.own,[own]],[actors.other,[other]],[actors.admin,[own,other,untouched]],[actors.quality,[own,other,untouched]],[actors.inactive,[]],[null,[]]]) {
      check((await as(actor,'select id from qms_quejas_bandeja')).map(r=>r.id).sort(), expected.sort())
      check((await as(actor,'select queja_id from queja_bandeja_actividad')).map(r=>r.queja_id).sort(), expected.sort())
    }
    await query("update usuarios set rol='sin_permiso' where id=$1",[actors.denied.id])
    check((await as(actors.denied,'select id from qms_quejas_bandeja')).length,0)
    for (const sql of ['select * from qms_quejas_bandeja','select * from queja_bandeja_actividad']) await rejected(()=>as(null,sql,[],'anon'))
    for (const sql of ['update queja_bandeja_actividad set gestionada=false','delete from queja_bandeja_actividad',"insert into queja_bandeja_actividad values(gen_random_uuid(),now(),false)",'select qms_private.track_complaint_activity()']) await rejected(()=>as(actors.admin,sql))
    // Leer/descargar (SELECT), el reloj técnico y un save idéntico no son movimientos.
    await unchanged(own,'select * from queja_adjuntos where queja_id=$1',[own])
    await unchanged(own,'update quejas set revision=revision+1 where id=$1',[own])
    await unchanged(own,'update quejas set estado=estado where id=$1',[own])
    await changed(own,"update quejas set estado='En Investigación' where id=$1",[own])
    await changed(own,'update quejas set responsable_id=$2 where id=$1',[own,actors.other.id])
    check((await as(actors.own,'select id from qms_quejas_bandeja')).length,0)
    check((await as(actors.other,'select id from qms_quejas_bandeja')).length,2)
    await changed(own,"update quejas set descripcion='Descripción corregida' where id=$1",[own])
    const revision = (await query('select revision from quejas where id=$1',[own]))[0].revision
    for (const [table, field, text] of [['quejas_actividad','descripcion','nota'],['quejas_comentarios','comentario','comentario'],['queja_adjuntos','nombre','documento']]) {
      const id = randomUUID()
      await changed(own, `insert into ${table}(id,queja_id,${field}${table==='quejas_actividad'?',tipo':''}) values($1,$2,$3${table==='quejas_actividad'?",'nota'":''})`, [id,own,text])
      await unchanged(own, `update ${table} set ${field}=${field} where id=$1`,[id])
      await changed(own, `update ${table} set ${field}=$2 where id=$1`,[id,text+' corregido'])
      await changed(own, `delete from ${table} where id=$1`,[id])
    }
    await unchanged(own,"insert into queja_resolution_drafts(queja_id,version,contenido,formato) values($1,1,'','plain')",[own])
    await changed(own,"update queja_resolution_drafts set contenido='Hallazgos' where queja_id=$1",[own])
    await unchanged(own,'update queja_resolution_drafts set version=version+1,updated_at=now() where queja_id=$1',[own])
    await changed(own,"insert into queja_informes(queja_id,version,contenido) values($1,1,'Informe')",[own])
    await unchanged(own,"insert into queja_informes(queja_id,version,contenido) values($1,2,'Informe')",[own])
    await changed(own,"insert into queja_informes(queja_id,version,contenido) values($1,3,'Informe corregido')",[own])
    check((await query('select revision from quejas where id=$1',[own]))[0].revision, revision)
    for (const [table, field] of [['queja_response_drafts','respuesta'],['queja_public_resolutions','respuesta'],['queja_investigation_assignments','instrucciones']]) {
      await changed(own,`insert into ${table}(queja_id,${field}) values($1,'Texto')`,[own])
      await unchanged(own,`update ${table} set ${field}=${field} where queja_id=$1`,[own])
      await changed(own,`update ${table} set ${field}='Corregido' where queja_id=$1`,[own])
    }
    // El orden completo precede a LIMIT/OFFSET y usa horas, no la etiqueta «hoy».
    const old = randomUUID(); await record(old,actors.own.id,'1999-01-01T12:00Z')
    for (let i=0;i<30;i++) await record(randomUUID(),actors.own.id,'2002-01-01T12:00Z')
    const ordered = 'select id from qms_quejas_bandeja order by ultima_actividad_relevante_at desc,fecha desc,id desc limit 25'
    check((await as(actors.admin,ordered)).some(r=>r.id===old),false)
    await changed(old,"update quejas set descripcion='Sube desde otra página' where id=$1",[old])
    check((await as(actors.admin,ordered))[0].id,old)
    await changed(other,"update quejas set descripcion='Movimiento siguiente' where id=$1",[other])
    check((await as(actors.admin,ordered)).slice(0,2).map(r=>r.id),[other,old])
    const tie = await as(actors.own,ordered)
    check(tie.slice(1).map(r=>r.id),tie.slice(1).map(r=>r.id).sort().reverse())
    // Nunca tuvo plazo, plazo conservado tras cerrar su run y completado prioritario.
    check((await as(actors.admin,'select plazo_filtro from qms_quejas_bandeja where id=$1',[old]))[0].plazo_filtro,'sin_plazo')
    await query("insert into qms_stage_runs(id,case_id,stage_id,calendar_id,started_at,expires_at,ended_at) values($1,$2,'quejas.evaluation',1,'2000-01-01','2000-01-05','2000-01-06')",[randomUUID(),old])
    check((await as(actors.admin,'select plazo_filtro from qms_quejas_bandeja where id=$1',[old]))[0].plazo_filtro,'vencidos')
    for (const n of [1,30,100]) {
      await query("update quejas set fecha_sla=(now() at time zone 'America/Costa_Rica')::date-$2::integer where id=$1",[other,n])
      check((await as(actors.admin,'select plazo_filtro from qms_quejas_bandeja where id=$1',[other]))[0].plazo_filtro,'vencidos')
    }
    await query("update quejas set fecha_sla=((now() at time zone 'America/Costa_Rica')::date)::timestamp at time zone 'America/Costa_Rica' where id=$1",[other])
    check((await as(actors.admin,'select plazo_filtro from qms_quejas_bandeja where id=$1',[other]))[0].plazo_filtro,'por_vencer')
    await query("update quejas set estado='Finalizado' where id=$1",[old])
    check((await as(actors.admin,'select plazo_filtro,actividad_contexto from qms_quejas_bandeja where id=$1',[old]))[0],{plazo_filtro:'completados',actividad_contexto:null})
    check((await query("select reloptions from pg_class where oid='qms_quejas_bandeja'::regclass"))[0].reloptions,['security_invoker=true'])
    await query('delete from quejas where id=$1',[old])
    check((await query('select 1 from queja_bandeja_actividad where queja_id=$1',[old])).length,0)
  }
  const evidence={checks,contextOnly,migrations:contextOnly?migrations.slice(0,1):migrations,remoteBusinessWrites:0}
  fs.writeFileSync(path.join(work,'evidence.json'),JSON.stringify(evidence,null,2)); console.log(JSON.stringify(evidence))
} finally { if(pool) await pool.end(); if(started) run('pg_ctl.exe',['-D',data,'-m','immediate','-w','stop']) }
