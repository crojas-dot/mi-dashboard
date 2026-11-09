// PostgreSQL aislado, identidades ficticias y definiciones remotas versionadas.
// No carga .env, no conecta a Supabase ni publica un calendario institucional.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const root = process.cwd()
const bin = process.env.QMS_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const work = path.join(root, '.performance', 'calendar-grants-db-' + Date.now())
const data = path.join(work, 'data'), port = 55457
const { Pool } = createRequire(path.join(root, '.performance/load-tools/package.json'))('pg')
const password = randomBytes(32).toString('hex')
const preflight = JSON.parse(fs.readFileSync('supabase/backups/calendar_preflight_20261015.json', 'utf8'))
const engine = JSON.parse(fs.readFileSync('supabase/backups/internal_notices_preflight_20261014.json', 'utf8'))
const schema = JSON.parse(fs.readFileSync('supabase/backups/quejas_workflow_schema_20261010.json', 'utf8'))
const migrationPath = 'supabase/migrations/20261015171835_qms_calendar_append_only_grants.sql'
const tables = ['qms_calendars', 'qms_stage_versions', 'qms_config_audit']
const writePrivileges = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
const actors = Object.fromEntries(['admin', 'quality', 'inactive'].map(key => [key, { id: randomUUID(), auth: randomUUID() }]))
const q = value => '"' + value.replaceAll('"', '""') + '"'
let pool, started = false, checks = 0
function run(binary, args) {
  const result = spawnSync(path.join(bin, binary), args, { encoding: 'utf8', stdio: 'ignore', windowsHide: true, timeout: 60000 })
  if (result.status !== 0) throw new Error('PostgreSQL fixture command failed: ' + binary)
}
function check(value, message) { assert.ok(value, message); checks++ }
async function rejects(fn, code, message) { await assert.rejects(fn, error => error.code === code, message); checks++ }
async function as(actor, sql, args = [], role = 'authenticated') {
  const connection = await pool.connect()
  try {
    await connection.query('SET ROLE ' + role)
    await connection.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor?.auth ?? ''])
    return (await connection.query(sql, args)).rows
  } finally {
    await connection.query('RESET ROLE')
    connection.release()
  }
}
const publish = (expected, holidays = [], actor = actors.admin, weekdays = [1, 2, 3, 4, 5]) => as(actor,
  'SELECT public.qms_publish_calendar($1,$2,$3,$4) id', [expected, weekdays, JSON.stringify(holidays), 'Calendario ficticio de prueba'])
const snapshot = async () => (await pool.query(`SELECT jsonb_build_object(
  'quejas',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM quejas c),
  'runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM qms_stage_runs r),
  'notices',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM qms_deadline_notices n)) value`)).rows[0].value

try {
  fs.mkdirSync(work, { recursive: true })
  const pw = path.join(work, 'pw')
  fs.writeFileSync(pw, password)
  run('initdb.exe', ['-D', data, '-U', 'qms_fixture', '-A', 'scram-sha-256', '--pwfile=' + pw, '--encoding=UTF8', '--locale=C'])
  fs.unlinkSync(pw)
  run('pg_ctl.exe', ['-D', data, '-l', path.join(work, 'postgres.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start'])
  started = true
  pool = new Pool({ host: '127.0.0.1', port, user: 'qms_fixture', password, database: 'postgres', max: 8, statement_timeout: 15000 })
  await pool.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE TABLE public.usuarios(id uuid PRIMARY KEY,auth_id uuid,rol text,estado text);
    CREATE FUNCTION public.app_usuario_actual_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
      SELECT id FROM public.usuarios WHERE auth_id=auth.uid() AND estado='activo'$$;
    CREATE TABLE public.quejas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),estado text NOT NULL,revision bigint NOT NULL DEFAULT 1,fecha_sla timestamptz,fecha_limite_investigacion timestamptz);
    CREATE TABLE public.qms_config_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,entity text NOT NULL,old_value jsonb,new_value jsonb NOT NULL,reason text,actor_id uuid,created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.qms_deadline_notices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid,offset_days integer,due_at timestamptz NOT NULL,processed_at timestamptz);`)
  const columns = schema.find(section => section.section === 'columns').data
  for (const table of ['qms_calendars', 'qms_stages', 'qms_stage_versions', 'qms_stage_runs']) {
    const ddl = columns.filter(column => column.table_name === table).map(column => `${q(column.column_name)} ${column.data_type === 'ARRAY' ? 'integer[]' : column.data_type}${column.column_name === 'id' && column.data_type === 'bigint' ? ' GENERATED BY DEFAULT AS IDENTITY' : column.column_default ? ' DEFAULT ' + column.column_default : ''}${column.is_nullable === 'NO' ? ' NOT NULL' : ''}`).join(',')
    await pool.query(`CREATE TABLE public.${q(table)} (${ddl}); ALTER TABLE public.${q(table)} ADD PRIMARY KEY(id)`)
  }
  await pool.query(`ALTER TABLE public.qms_stage_versions ADD FOREIGN KEY(stage_id) REFERENCES public.qms_stages(id);
    ALTER TABLE public.qms_stage_runs ADD FOREIGN KEY(calendar_id) REFERENCES public.qms_calendars(id);
    ALTER TABLE public.qms_stage_runs ADD FOREIGN KEY(rule_id) REFERENCES public.qms_stage_versions(id);
    ALTER TABLE public.qms_stage_runs ADD FOREIGN KEY(case_id) REFERENCES public.quejas(id) DEFERRABLE INITIALLY DEFERRED`)
  for (const [name, actor] of Object.entries(actors)) await pool.query('INSERT INTO public.usuarios VALUES($1,$2,$3,$4)', [actor.id, actor.auth, name === 'quality' ? 'calidad' : 'admin', name === 'inactive' ? 'inactivo' : 'activo'])
  // Se cargan los publishers efectivos, no una implementación simplificada del fixture.
  for (const name of ['app_es_admin', 'qms_publish_calendar', 'qms_publish_stage']) await pool.query(preflight.functions.find(fn => fn.name === name).body)
  for (const name of ['qms_business_day', 'qms_due', 'qms_complaint_notice_due', 'qms_sync_queja']) await pool.query(engine.functions.find(fn => fn.name === name).body)
  await pool.query(`REVOKE EXECUTE ON FUNCTION public.qms_publish_calendar(bigint,integer[],jsonb,text),public.qms_publish_stage(text,bigint,integer,text,integer[],text,text) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION public.qms_publish_calendar(bigint,integer[],jsonb,text),public.qms_publish_stage(text,bigint,integer,text,integer[],text,text) TO authenticated,service_role;
    INSERT INTO public.qms_calendars(weekdays) VALUES(ARRAY[1,2,3,4,5]);
    INSERT INTO public.qms_stages VALUES('quejas.evaluation','quejas','Evaluación','Recibido','Decisión'),('quejas.investigation','quejas','Investigación','En Investigación','Cierre');
    INSERT INTO public.qms_stage_versions(stage_id,duration,day_type,alerts,expiration_action) VALUES('quejas.evaluation',3,'business_days',ARRAY[1],'notify_quality'),('quejas.investigation',15,'business_days',ARRAY[5,3],'notify_quality');
    CREATE TRIGGER qms_queja_stage BEFORE INSERT OR UPDATE ON public.quejas FOR EACH ROW EXECUTE FUNCTION public.qms_sync_queja();
    INSERT INTO public.quejas(estado) VALUES('Recibido'),('En Investigación')`)
  for (const table of tables) await pool.query(`ALTER TABLE public.${q(table)} ENABLE ROW LEVEL SECURITY; GRANT ALL ON public.${q(table)} TO authenticated,service_role`)
  for (const policy of preflight.policies.filter(policy => tables.includes(policy.tablename))) await pool.query(`CREATE POLICY ${q(policy.policyname)} ON public.${q(policy.tablename)} FOR ${policy.cmd} TO ${policy.roles.map(q).join(',')}${policy.qual ? ' USING(' + policy.qual + ')' : ''}${policy.with_check ? ' WITH CHECK(' + policy.with_check + ')' : ''}`)
  const before = await snapshot()
  const grantsBefore = (await pool.query(`SELECT c.oid,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`, [tables])).rows
  check(grantsBefore.length === 3, 'Fixture reproduce las tres tablas afectadas')
  check((await pool.query("SELECT has_table_privilege('authenticated','public.qms_calendars','TRUNCATE') allowed")).rows[0].allowed, 'Fixture conserva el grant TRUNCATE previo')
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
  for (const table of tables) {
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of writePrivileges) check(!(await pool.query('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.' + table, privilege])).rows[0].allowed, role + ' sin ' + privilege + ' en ' + table)
    }
    check((await pool.query('SELECT has_table_privilege($1,$2,$3) allowed', ['authenticated', 'public.' + table, 'SELECT'])).rows[0].allowed, 'SELECT conservado en ' + table)
    check((await pool.query('SELECT has_table_privilege($1,$2,$3) allowed', ['service_role', 'public.' + table, 'TRUNCATE'])).rows[0].allowed, 'service_role intacto en ' + table)
    const editable = table === 'qms_calendars' ? 'weekdays' : table === 'qms_stage_versions' ? 'duration' : 'reason'
    const statements = [`INSERT INTO public.${q(table)} DEFAULT VALUES`, `UPDATE public.${q(table)} SET ${editable}=${editable}`, `DELETE FROM public.${q(table)}`, `TRUNCATE public.${q(table)}`]
    for (const actor of [actors.admin, actors.quality, actors.inactive]) for (const sql of statements) await rejects(() => as(actor, sql), '42501', 'Escritura directa rechazada por ACL aunque el actor sea admin')
    for (const sql of statements) await rejects(() => as(null, sql, [], 'anon'), '42501', 'Anon sin escritura directa')
  }
  check((await as(actors.admin, 'SELECT id FROM public.qms_calendars')).length === 1, 'Admin sigue leyendo el calendario')
  check((await as(actors.quality, 'SELECT id FROM public.qms_stage_versions')).length === 2, 'Lectura de reglas preservada')
  for (const actor of [actors.quality, actors.inactive, null]) await rejects(() => publish(1, [], actor), '42501', 'Solo admin activo publica calendario')
  await rejects(() => as(null, 'SELECT public.qms_publish_calendar(1,ARRAY[1,2,3,4,5],\'[]\',NULL)', [], 'anon'), '42501', 'Anon no ejecuta publisher')
  await rejects(() => publish(1, [{ date: '2026-02-30', description: 'Inválido' }]), '22008', 'Fecha imposible rechazada')
  await rejects(() => publish(1, [{ date: '2026-10-16', description: 'Uno' }, { date: '2026-10-16', description: 'Dos' }]), 'P0001', 'No admite feriado duplicado')
  await rejects(() => publish(1, [], actors.admin, []), '22023', 'No admite calendario sin días hábiles')
  const holiday = [{ date: '2026-10-16', description: 'Feriado ficticio' }]
  const id = (await publish(1, holiday))[0].id
  check(Number(id) > 1, 'Admin publica una nueva versión mediante RPC')
  const audit = (await as(actors.admin, 'SELECT * FROM public.qms_config_audit WHERE entity=\'calendar\''))[0]
  check(audit.actor_id === actors.admin.id && Number(audit.old_value.id) === 1 && Number(audit.new_value.id) === Number(id) && audit.new_value.holidays[0].description === holiday[0].description, 'Auditoría conserva actor, motivo y versiones anterior/nueva')
  check((await as(actors.quality, 'SELECT id FROM public.qms_config_audit')).length === 0, 'No admin no puede leer auditoría de configuración')
  await rejects(() => publish(1), '40001', 'Versión obsoleta no sobreescribe calendario')
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'Migración y publicación preservan exactamente expedientes, snapshots, plazos y avisos abiertos')
  const race = await Promise.allSettled([publish(id), publish(id)])
  check(race.filter(result => result.status === 'fulfilled').length === 1 && race.some(result => result.status === 'rejected' && result.reason.code === '40001'), 'Publicaciones simultáneas tienen un ganador y un conflicto CAS')
  check((await pool.query("SELECT count(*)::int n FROM public.qms_config_audit WHERE entity='calendar'")).rows[0].n === 2, 'Conflictos y validaciones fallidas no generan auditorías/versiones')
  const rule = (await as(actors.admin, "SELECT public.qms_publish_stage('quejas.evaluation',1,3,'business_days',ARRAY[1],'notify_quality','Prueba de compatibilidad') id"))[0].id
  check(Number(rule) > 2, 'Publisher existente de etapas conserva ejecución autorizada')
  await rejects(() => as(actors.quality, "SELECT public.qms_publish_stage('quejas.evaluation',$1,3,'business_days',ARRAY[1],'notify_quality',NULL)", [rule]), '42501', 'No admin tampoco publica reglas')
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'Publicar reglas tampoco modifica etapas abiertas')
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
  check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'Hardening idempotente sin modificar datos')
  const evidence = { ok: true, checks, at: new Date().toISOString(), migration: migrationPath, scope: 'Isolated PostgreSQL; grants, actual publishers, CAS, audit, open snapshots; no remote writes' }
  fs.writeFileSync(path.join(root, '.performance/qms-calendar-grants-db-evidence.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence))
} finally {
  if (pool) await pool.end()
  if (started) run('pg_ctl.exe', ['-D', data, '-w', 'stop', '-m', 'fast'])
}
