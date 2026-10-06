// Instancia PostgreSQL aislada. Nunca lee .env.local ni acepta URLs remotas.
// Requiere binarios PostgreSQL y: npm install --prefix .performance/load-tools pg@8.16.3
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
const root = process.cwd(), work = path.join(root, '.performance', 'etapas-'+Date.now())
const bin = process.env.QMS_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const require = createRequire(path.join(root,'.performance/load-tools/package.json'))
const { Pool } = require('pg')
fs.mkdirSync(work,{recursive:true})
const password=randomBytes(24).toString('hex'), pw=path.join(work,'pw')
fs.writeFileSync(pw,password)
const data=path.join(work,'data'), port=55439
function run(binary,args) {
 const result=spawnSync(path.join(bin,binary),args,{encoding:'utf8',windowsHide:true,stdio:'inherit',timeout:60000})
 if(result.status!==0) throw new Error(result.stderr || result.stdout || 'No se pudo ejecutar PostgreSQL')
}
let pool, started=false
const actor='00000000-0000-4000-8000-000000000001'
function extract(file,name) {
 const source=fs.readFileSync(path.join(root,'supabase',file),'utf8')
 const pattern=new RegExp('CREATE OR REPLACE FUNCTION (?:public\\.)?'+name+'\\([\\s\\S]*?\\$\\$;','i')
 const match=source.match(pattern)
 if(!match) throw new Error('No se encontró '+name)
 return match[0]
}
try {
 run('initdb.exe',['-D',data,'-U','qms_test','-A','scram-sha-256','--pwfile='+pw,'--encoding=UTF8','--locale=C'])
 fs.unlinkSync(pw)
 run('pg_ctl.exe',['-D',data,'-l',path.join(work,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -c max_connections=80`,'-w','start'])
 started=true
 pool=new Pool({host:'127.0.0.1',port,user:'qms_test',password,database:'postgres',max:50,statement_timeout:10000})
 await pool.query(`
 CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE TABLE usuarios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_id uuid,nombre text,email text,rol text,estado text);
 INSERT INTO usuarios(id,auth_id,nombre,rol,estado) VALUES('${actor}','${actor}','Prueba','admin','activo');
 CREATE TABLE quejas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),folio text UNIQUE,cliente_nombre text,email_cliente text,categoria text,descripcion text,prioridad text,estado text,fecha timestamptz DEFAULT now(),fecha_sla timestamptz,fecha_limite_investigacion timestamptz,fecha_cierre timestamptz,resolucion text,notas text,responsable_id uuid,derivado_sacp_id uuid);
 CREATE TABLE acciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),folio text,tipo text,origen text,origen_id uuid,descripcion text,estado text,seguimiento_porcentaje int,fecha_apertura timestamptz,fecha_limite timestamptz,prioridad text);
 CREATE TABLE documentos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),titulo text,estado text,created_at timestamptz DEFAULT now());
 CREATE TABLE riesgos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),folio text,descripcion text,estado text,fecha_identificacion timestamptz DEFAULT now());
 CREATE TABLE logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),fecha timestamptz,usuario_id uuid,accion text,modulo text,detalle text);
 CREATE TABLE notificaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario_id uuid,fecha timestamptz,tipo text,mensaje text,enlace text,origen_id uuid);
 CREATE TABLE quejas_comentarios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),queja_id uuid,usuario_id uuid,comentario text,tipo text,visible_cliente boolean,fecha timestamptz);
 CREATE TABLE catalogos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),modulo text,tipo text,valor text,color text,orden int,activo boolean);
 CREATE TABLE sla_config(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),proceso text,prioridad text,dias_vencimiento int);
 CREATE SEQUENCE seq_folio_quejas; CREATE SEQUENCE seq_folio_sacp;
 GRANT SELECT ON quejas,catalogos,acciones,documentos,riesgos TO authenticated;
 CREATE FUNCTION reabrir_queja(uuid,text) RETURNS quejas LANGUAGE sql AS $$ SELECT q FROM quejas q WHERE id=$1 $$;
 `)
 for(const [file,names] of [
 ['005_seguridad_flujos_quejas.sql',['app_es_staff','app_es_admin','app_usuario_actual_id','crear_queja_interna','actualizar_detalles_queja','derivar_queja_a_sacp','agregar_comentario_queja']],
 ['006_permisos_dinamicos_colaborador.sql',['app_es_colaborador']],
 ['009_transicionar_queja_completa.sql',['transicionar_queja']],
 ['seed-folios.sql',['generar_folio_queja','generar_folio_sacp']]]) {
   for(const name of names) await pool.query(extract(file,name))
 }
 await pool.query(`INSERT INTO quejas(cliente_nombre,estado,fecha_sla) VALUES('Histórico','Recibido','2026-01-03T12:00:00Z')`)
 await pool.query(fs.readFileSync(path.join(root,'supabase/migrations/20260923205654_etapas_versionadas.sql'),'utf8'))
 const asUser=async(sql,args=[])=>{
   const client=await pool.connect()
   try {
     await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated')
     await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor])
     const result=await client.query(sql,args); await client.query('COMMIT');return result
   } catch(error){await client.query('ROLLBACK');throw error} finally{client.release()}
 }
 const historic=(await pool.query("SELECT fecha_sla FROM quejas WHERE cliente_nombre='Histórico'")).rows[0]
 assert.equal(historic.fecha_sla.toISOString(),'2026-01-03T12:00:00.000Z')
 const calendar=(await pool.query('SELECT max(id) AS id FROM qms_calendars')).rows[0].id
 const due=(await pool.query("SELECT qms_due('2026-09-25T12:00:00Z',1,'business_days',$1) d",[calendar])).rows[0].d
 assert.equal(due.toISOString(),'2026-09-29T05:59:59.999Z')
 const created=(await asUser("SELECT * FROM crear_queja_interna('Prueba','test@example.test','Queja','Local','Alta')")).rows[0]
 // SELECT (rpc()).* puede invocar funciones volátiles por columna: usar FROM siempre.
 const testCase=(await asUser("SELECT * FROM crear_queja_interna('Concurrencia','test@example.test','Queja','Local','Alta')")).rows[0]
 const race=await Promise.allSettled(Array.from({length:20},()=>asUser("SELECT * FROM qms_transition($1,$2,'investigation',NULL,'Procede',$3,NULL)",[testCase.id,testCase.revision,actor])))
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(race.filter(r=>r.status==='rejected'&&r.reason.code==='40001').length,19)
 const runBefore=(await pool.query('SELECT * FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL',[testCase.id])).rows[0]
 await asUser("SELECT qms_publish_stage('quejas.investigation',$1,20,'business_days',ARRAY[3,1],'notify_quality','Prueba')",[runBefore.rule_id])
 const runAfter=(await pool.query('SELECT * FROM qms_stage_runs WHERE id=$1',[runBefore.id])).rows[0]
 assert.equal(runAfter.expires_at.toISOString(),runBefore.expires_at.toISOString())
 assert.equal(runAfter.rule_id,runBefore.rule_id)
 const editRevision=(await pool.query('SELECT revision FROM quejas WHERE id=$1',[testCase.id])).rows[0].revision
 const edits=await Promise.allSettled(Array.from({length:20},(_,i)=>asUser('SELECT * FROM qms_update_details($1,$2,NULL,NULL,NULL,$3)',[testCase.id,editRevision,'Texto '+i])))
 assert.equal(edits.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(edits.filter(r=>r.status==='rejected'&&r.reason.code==='40001').length,19)
 await assert.rejects(asUser("SELECT qms_publish_stage('quejas.investigation',3,0,'business_days',ARRAY[1],'notify_quality')"))
 await pool.query("UPDATE qms_deadline_notices SET due_at=now()-interval '1 day'")
 const notices=await Promise.all(Array.from({length:10},()=>pool.query('SELECT qms_process_notices()')))
 const remaining=(await pool.query('SELECT count(*)::int n FROM qms_deadline_notices WHERE processed_at IS NULL')).rows[0].n
 assert.equal(remaining,0)
 console.log(JSON.stringify({status:'passed',checks:['preservación legacy','calendario hábil','20 transiciones: 1 éxito/19 conflictos','snapshot tras publicar','20 ediciones: 1 éxito/19 conflictos','validación','10 workers de alertas'],created:!!created.id,workers:notices.length}))
} finally {
 await pool?.end()
 if(started)run('pg_ctl.exe',['-D',data,'-m','fast','-w','stop'])
 if(fs.existsSync(pw))fs.unlinkSync(pw)
}
