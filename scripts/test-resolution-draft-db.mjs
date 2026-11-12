// PostgreSQL temporal y datos sintéticos; nunca carga .env ni conecta a ECA-QMS.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const root = process.cwd(), bin = process.env.QMS_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const work = path.join(root, '.performance', 'resolution-draft-db-' + Date.now()), data = path.join(work, 'data'), port = 55468
const { Pool } = createRequire(path.join(root, '.performance/load-tools/package.json'))('pg')
const password = randomBytes(32).toString('hex'), migration = fs.readdirSync('supabase/migrations').find(name => name.endsWith('_quejas_borrador_resolucion.sql'))
let pool, started = false, checks = 0
const check = (a, b) => { assert.deepEqual(a, b); checks++ }
const run = (exe, args) => { const r = spawnSync(path.join(bin, exe), args, { encoding: 'utf8', windowsHide: true, timeout: 60000 }); if (r.status !== 0) throw new Error((r.error?.message ?? r.stderr ?? 'PostgreSQL temporal no disponible').slice(-900)) }
const own = { id: randomUUID(), auth: randomUUID() }, other = { id: randomUUID(), auth: randomUUID() }, admin = { id: randomUUID(), auth: randomUUID() }, quality = { id: randomUUID(), auth: randomUUID() }, inactive = { id: randomUUID(), auth: randomUUID() }, denied = { id: randomUUID(), auth: randomUUID() }, reader = { id: randomUUID(), auth: randomUUID() }
const id = randomUUID()
async function as(actor, sql, args = [], role = 'authenticated') {
  const c = await pool.connect()
  try { await c.query('SET ROLE ' + role); await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor?.auth ?? '']); return (await c.query(sql, args)).rows }
  finally { await c.query('RESET ROLE'); c.release() }
}
const save = (actor, version, content = 'Propuesta sintética', revision = 7, format = 'plain') => as(actor, 'select qms_save_resolution_draft($1,$2,$3,$4,$5) as draft', [id, revision, version, content, format]).then(r => r[0].draft)
const rejected = async (run, code) => { await assert.rejects(run, e => e.code === code); checks++ }
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
    create table quejas(id uuid primary key,estado text,responsable_id uuid,revision bigint,resolucion text,resolucion_formato text);
    create table transition_calls(id uuid);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function app_usuario_actual_id() returns uuid language sql stable security definer set search_path='' as $$select id from public.usuarios where auth_id=auth.uid() and estado='activo'$$;
    create function app_es_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol='admin')$$;
    create function app_es_staff() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol in ('admin','calidad'))$$;
    create function app_es_colaborador() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.usuarios where auth_id=auth.uid() and estado='activo' and rol='colaborador')$$;
    create function app_tiene_permiso(module text,write boolean default false) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.permisos p join public.usuarios u on u.rol=p.rol where u.auth_id=auth.uid() and u.estado='activo' and p.modulo=module and p.leer and (not write or p.escribir))$$;
    alter table quejas enable row level security;
    grant select on quejas to authenticated;
    create policy cases_read on quejas for select to authenticated using(app_es_admin() or app_es_staff() and app_tiene_permiso('quejas') or app_es_colaborador() and app_tiene_permiso('mis_quejas') and responsable_id=app_usuario_actual_id());
    create function qms_transition_complaint(p_id uuid,p_expected bigint,p_state text,p_resolution text default null,p_justification text default null,p_owner uuid default null,p_reopen text default null,p_office_number text default null,p_resolution_format text default null,p_justification_format text default null)
    returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb; begin
      if p_state<>'gc_review' then raise exception 'Estado incorrecto'; end if;
      insert into public.transition_calls values(p_id);
      update public.quejas set estado='Pendiente de Revisión GC',revision=revision+1,resolucion=p_resolution,resolucion_formato=p_resolution_format where id=p_id and revision=p_expected returning to_jsonb(quejas) into result;
      return result; end$$;`)
  for (const [actor, rol, estado] of [[own,'colaborador','activo'],[other,'colaborador','activo'],[admin,'admin','activo'],[quality,'calidad','activo'],[inactive,'admin','inactivo'],[denied,'calidad_sin_permiso','activo'],[reader,'lector','activo']]) await pool.query('insert into usuarios values($1,$2,$3,$4)', [actor.id,actor.auth,rol,estado])
  await pool.query("insert into permisos values('colaborador','mis_quejas',true,true),('calidad','quejas',true,true),('calidad_sin_permiso','quejas',true,false),('lector','mis_quejas',true,true)")
  await pool.query("insert into quejas values($1,'En Investigación',$2,7,'Propuesta anterior inmutable','plain')", [id,own.id])
  await pool.query(fs.readFileSync(path.join('supabase/migrations',migration),'utf8'))
  const before = (await pool.query('select * from quejas where id=$1',[id])).rows[0]
  const saved = await save(own,0,'**Hallazgos**',7,'markdown')
  check(saved.version,1); check(saved.actualizado_por,own.id); check(saved.formato,'markdown')
  check((await pool.query('select * from quejas where id=$1',[id])).rows[0],before)
  check((await pool.query('select count(*)::int as n from transition_calls')).rows[0].n,0)
  check((await as(own,'select contenido from queja_resolution_drafts')).map(r=>r.contenido),['**Hallazgos**'])
  for (const actor of [other,inactive,denied,reader,null]) {
    check((await as(actor,'select contenido from queja_resolution_drafts')).length,0)
    await rejected(()=>save(actor,1),'42501')
  }
  check((await as(admin,'select contenido from queja_resolution_drafts')).length,1)
  check((await as(quality,'select contenido from queja_resolution_drafts')).length,1)
  await rejected(()=>as(null,'select * from queja_resolution_drafts',[],'anon'),'42501')
  await rejected(()=>as(own,"update queja_resolution_drafts set contenido='Bypass'"),'42501')
  await rejected(()=>as(own,'delete from queja_resolution_drafts'),'42501')
  await rejected(()=>save(own,0),'40001'); await rejected(()=>save(own,1,'Texto',99),'40001')
  await rejected(()=>save(own,1,'x'.repeat(10001)),'22023'); await rejected(()=>save(own,1,'Texto',7,'html'),'22023')
  await rejected(()=>save(own,-1),'22023'); await rejected(()=>save(own,1,'Texto',null),'40001')
  await rejected(()=>as(own,'select qms_submit_resolution_draft($1,7,1,$2,$3)',[id,'','plain']),'22023')
  const race = await Promise.allSettled([save(own,1,'Primera computadora'),save(admin,1,'Segunda computadora')])
  check(race.filter(r=>r.status==='fulfilled').length,1); check(race.find(r=>r.status==='rejected').reason.code,'40001')
  const version = race.find(r=>r.status==='fulfilled').value.version
  check(version,2)
  const empty = await save(quality,version,''); check(empty.contenido,''); check(empty.version,3)
  check((await pool.query('select resolucion from quejas where id=$1',[id])).rows[0].resolucion,before.resolucion)
  await rejected(()=>as(own,'select qms_submit_resolution_draft($1,7,2,$2,$3)',[id,'Obsoleta','plain']),'40001')
  const submit = await as(own,'select qms_submit_resolution_draft($1,7,3,$2,$3) as result',[id,'Propuesta enviada','plain'])
  check(submit[0].result.estado,'Pendiente de Revisión GC'); check(submit[0].result.resolucion,'Propuesta enviada')
  check((await pool.query('select count(*)::int as n from queja_resolution_drafts')).rows[0].n,0)
  await rejected(()=>save(own,0,'Texto',8),'55000')
  await pool.query("update quejas set estado='En Investigación',revision=9 where id=$1",[id])
  await save(own,0,'Borrador de devolución',9)
  await pool.query('update quejas set responsable_id=$2,revision=10 where id=$1',[id,other.id])
  check((await pool.query('select count(*)::int as n from queja_resolution_drafts')).rows[0].n,0)
  await rejected(()=>save(own,0,'Texto',10),'42501')
  for (const estado of ['Recibido','Resuelto','Finalizado','No Procede',null]) {
    await pool.query('update quejas set estado=$2 where id=$1',[id,estado])
    await rejected(()=>save(admin,0,'Texto',10),'55000')
  }
  check((await pool.query("select has_function_privilege('anon','public.qms_save_resolution_draft(uuid,bigint,bigint,text,text)','execute') as allowed")).rows[0].allowed,false)
  check((await pool.query("select bool_and(not prosecdef) as invoker from pg_proc where oid in ('public.qms_save_resolution_draft(uuid,bigint,bigint,text,text)'::regprocedure,'public.qms_submit_resolution_draft(uuid,bigint,bigint,text,text)'::regprocedure)")).rows[0].invoker,true)
  const evidence = { checks, migration, remoteBusinessWrites:0,coverage:['RLS y grants','identidad operativa distinta de Auth','roles/inactivos/ajenas/anónimo','CAS de expediente y borrador','carrera entre computadoras','guardar sin transicionar','enviar atómico','limpieza al enviar/reasignar','límite/formato/estados no editables'] }
  fs.writeFileSync(path.join(work,'evidence.json'),JSON.stringify(evidence,null,2)); console.log(JSON.stringify(evidence))
} finally { if(pool) await pool.end(); if(started) run('pg_ctl.exe',['-D',data,'-m','immediate','-w','stop']) }
