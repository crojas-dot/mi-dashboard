// Reproduce SQL/ACL con identidades ficticias. No carga .env ni llama al proyecto remoto.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const root=process.cwd(), bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin'
const work=path.join(root,'.performance','quejas-db-'+Date.now()), data=path.join(work,'data'),port=55453
const {Pool}=createRequire(path.join(root,'.performance/load-tools/package.json'))('pg')
const password=randomBytes(32).toString('hex');let pool,started=false,checks=0
const schema=JSON.parse(fs.readFileSync('supabase/backups/quejas_workflow_schema_20261010.json','utf8'))
const section=n=>schema.find(x=>x.section===n).data
const q=(value)=>'"'+value.replaceAll('"','""')+'"'
function run(binary,args){const r=spawnSync(path.join(bin,binary),args,{encoding:'utf8',stdio:'ignore',windowsHide:true,timeout:60000});if(r.status!==0)throw new Error('PostgreSQL fixture command failed')}
function check(c,m){assert.ok(c,m);checks++}
async function rejects(fn,code,m){await assert.rejects(fn,e=>e.code===code,m);checks++}
async function as(actor,sql,args=[],role='authenticated'){const c=await pool.connect();try{await c.query('SET ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor?.auth??'']);return(await c.query(sql,args)).rows}finally{await c.query('RESET ROLE');c.release()}}
const actors=Object.fromEntries(['admin','quality','owner','other','inactive','denied'].map(k=>[k,{id:randomUUID(),auth:randomUUID()}]))
const newCase=async(actor=actors.admin,email='person@example.test',type='Observación')=>(await as(actor,'SELECT to_jsonb(public.crear_queja_interna($1,$2,$3,$4,NULL)) value',['Persona ficticia',email,type,'Detalle ficticio']))[0].value
const transition=async(c,state,params={},actor=actors.admin)=>(await as(actor,'SELECT public.qms_transition_complaint($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value',[c.id,c.revision,state,params.resolution??null,params.justification??null,params.owner??null,params.reopen??null,params.office??null,params.resolution?'markdown':null,params.justification?'markdown':null]))[0].value
const register=async(c,area,office,actor=actors.admin)=>(await as(actor,'SELECT public.qms_update_complaint_register($1,$2,$3,$4,$5) value',[c.id,c.revision,area,office,'Observación interna']))[0].value
const claim=async(nonce=randomUUID(),limit=5,lease=120)=>(await as(null,'SELECT * FROM public.qms_mail_claim_batch($1,$2,$3,$4)',[limit,lease,nonce,Math.floor(Date.now()/1000)],'service_role'))
try {
 fs.mkdirSync(work,{recursive:true});const pw=path.join(work,'pw');fs.writeFileSync(pw,password)
 run('initdb.exe',['-D',data,'-U','qms_fixture','-A','scram-sha-256','--pwfile='+pw,'--encoding=UTF8','--locale=C']);fs.unlinkSync(pw)
 run('pg_ctl.exe',['-D',data,'-l',path.join(work,'postgres.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true
 pool=new Pool({host:'127.0.0.1',port,user:'qms_fixture',password,database:'postgres',max:20,statement_timeout:15000})
 await pool.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
 CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TABLE usuarios(id uuid PRIMARY KEY,auth_id uuid,rol text,estado text);
 CREATE TABLE permisos(rol text,modulo text,leer boolean,escribir boolean);
 CREATE TABLE logs(id uuid DEFAULT gen_random_uuid(),fecha timestamptz,usuario_id uuid,accion text,modulo text,detalle text);
 CREATE TABLE notificaciones(id uuid DEFAULT gen_random_uuid(),usuario_id uuid,fecha timestamptz,tipo text,mensaje text,enlace text,origen_id text);
 CREATE TABLE folios_quejas_anuales(anio integer PRIMARY KEY,ultimo integer);
 CREATE TABLE qms_config_audit(id bigint GENERATED ALWAYS AS IDENTITY,entity text NOT NULL,old_value jsonb,new_value jsonb NOT NULL,reason text,actor_id uuid,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE qms_case_events(id bigint GENERATED ALWAYS AS IDENTITY,module text,case_id uuid,kind text,occurred_at timestamptz,provenance text DEFAULT 'observed');
 CREATE TABLE qms_deadline_notices(id uuid DEFAULT gen_random_uuid(),run_id uuid,offset_days integer,due_at timestamptz NOT NULL,processed_at timestamptz);`)
 for(const table of ['quejas','catalogos','qms_calendars','qms_stages','qms_stage_versions','qms_stage_runs']) {
   const cols=section('columns').filter(x=>x.table_name===table)
   const ddl=cols.map(x=>`${q(x.column_name)} ${x.data_type==='ARRAY'?'integer[]':x.data_type}${x.column_name==='id'&&x.data_type==='bigint'?' GENERATED BY DEFAULT AS IDENTITY':x.column_default?' DEFAULT '+x.column_default:''}${x.is_nullable==='NO'?' NOT NULL':''}`).join(',')
   await pool.query(`CREATE TABLE public.${q(table)} (${ddl})`)
   if(['qms_calendars','qms_stage_versions','qms_stages'].includes(table)) await pool.query(`ALTER TABLE ${q(table)} ADD PRIMARY KEY(id)`)
 }
 for(const c of [...section('constraints')].sort((a,b)=>Number(a.definition.startsWith('FOREIGN'))-Number(b.definition.startsWith('FOREIGN'))))await pool.query(`ALTER TABLE public.${q(c.table)} ADD CONSTRAINT ${q(c.name)} ${c.definition}`)
 for(const [name,a]of Object.entries(actors))await pool.query('INSERT INTO usuarios VALUES($1,$2,$3,$4)',[a.id,a.auth,name==='quality'?'calidad':['owner','other'].includes(name)?'colaborador':name==='denied'?'calidad':'admin',name==='inactive'?'inactivo':'activo'])
 await pool.query("INSERT INTO permisos VALUES('calidad','quejas',true,true),('colaborador','mis_quejas',true,true)")
 // Usuario sin permiso usa un rol distinto para verificar el guard de módulo.
 await pool.query("UPDATE usuarios SET rol='auditor' WHERE id=$1",[actors.denied.id])
 await pool.query("INSERT INTO qms_calendars(id,weekdays) VALUES(1,ARRAY[1,2,3,4,5]);SELECT setval(pg_get_serial_sequence('qms_calendars','id'),1);INSERT INTO qms_stages VALUES('quejas.evaluation','quejas','Evaluación','Recibido','Decisión'),('quejas.investigation','quejas','Investigación','En Investigación','Cierre');INSERT INTO qms_stage_versions(id,stage_id,duration,day_type,alerts,expiration_action) VALUES(1,'quejas.evaluation',3,'calendar_days',ARRAY[1],'notify_quality'),(2,'quejas.investigation',15,'business_days',ARRAY[3,1],'notify_quality');SELECT setval(pg_get_serial_sequence('qms_stage_versions','id'),2)")
 const states={Recibido:'received','En Investigación':'investigation','Pendiente de Revisión GC':'quality_review',Resuelto:'resolved',Finalizado:'finished','No Procede':'rejected'}
 for(const [internal,code]of Object.entries(states))await pool.query("INSERT INTO catalogos(modulo,tipo,valor,valor_interno,codigo,color) VALUES('quejas','estado_queja',$1,$1,$2,'primary')",[internal,code])
 await pool.query("CREATE TABLE formularios_publicos(id uuid PRIMARY KEY,token text,activo boolean,modulo text);CREATE TABLE public_form_submissions(form_id uuid,submission_id uuid,payload_hash text,queja_id uuid,created_at timestamptz DEFAULT now(),finalized_at timestamptz,PRIMARY KEY(form_id,submission_id));CREATE TABLE public_form_rate_limits(key_hash text,operation text,attempts integer,reset_at timestamptz,PRIMARY KEY(key_hash,operation))")
 const gateway=fs.readFileSync('supabase/migrations/20261008224037_public_forms_gateway.sql','utf8')
 const rate=gateway.slice(gateway.indexOf('CREATE FUNCTION public.public_form_consume_rate'),gateway.indexOf('CREATE FUNCTION public.public_form_create_submission'))
 await pool.query(rate)
 for(const f of section('functions'))await pool.query(f.body)
 await pool.query('CREATE VIEW public.qms_quejas WITH(security_invoker=true) AS '+section('views').find(x=>x.name==='qms_quejas').definition)
 for(const t of section('triggers'))await pool.query(t.definition)
 for(const table of ['quejas','catalogos','qms_calendars','qms_stage_versions','qms_stage_runs'])await pool.query(`ALTER TABLE ${q(table)} ENABLE ROW LEVEL SECURITY`)
 for(const p of section('policies').filter(x=>['quejas','catalogos','qms_calendars','qms_stage_versions','qms_stage_runs'].includes(x.tablename))) await pool.query(`CREATE POLICY ${q(p.policyname)} ON ${q(p.tablename)} FOR ${p.cmd} TO ${p.roles.map(q).join(',')}${p.qual?' USING('+p.qual+')':''}${p.with_check?' WITH CHECK('+p.with_check+')':''}`)
 await pool.query('GRANT SELECT ON qms_quejas TO authenticated')
 const historical=(await pool.query("INSERT INTO quejas(folio,cliente_nombre,email_cliente,categoria,descripcion,estado,fecha) VALUES('2026-000','Prueba histórica','old@example.test','Queja','Texto histórico','Recibido',now()) RETURNING to_jsonb(quejas) value")).rows[0].value
 await pool.query("UPDATE quejas SET fecha_recepcion_gc=NULL,tipo=NULL WHERE id=$1",[historical.id])
 const oldDue=(await pool.query('SELECT expires_at FROM qms_stage_runs WHERE case_id=$1',[historical.id])).rows[0].expires_at.toISOString()
 const core=fs.readFileSync('supabase/migrations/20261011044303_quejas_workflow_completion.sql','utf8')
 await pool.query('BEGIN');await pool.query(core);await pool.query('COMMIT')
 check((await pool.query('SELECT expires_at FROM qms_stage_runs WHERE case_id=$1',[historical.id])).rows[0].expires_at.toISOString()===oldDue,'No recalcula snapshots históricos')
 check((await pool.query("SELECT duration,day_type FROM qms_stage_versions WHERE stage_id='quejas.evaluation' ORDER BY id DESC LIMIT 1")).rows[0].day_type==='business_days','Recepción hábil nueva versión')
 check((await pool.query("SELECT public.qms_due('2026-10-09T18:00Z',3,'business_days',1) d")).rows[0].d.toISOString()==='2026-10-15T05:59:59.999Z','Viernes + tres días hábiles vence miércoles')
 check((await pool.query("SELECT public.qms_complaint_notice_due('2026-10-20T05:59:59.999Z',1,'business_days',1) d")).rows[0].d.toISOString()==='2026-10-16T12:00:00.000Z','Aviso lunes retrocede al viernes')
 await pool.query('BEGIN');await pool.query(fs.readFileSync('supabase/migrations/20261011044317_quejas_mail_outbox.sql','utf8'));await pool.query('COMMIT')
 await pool.query(fs.readFileSync('supabase/migrations/20261011044810_quejas_rpc_surface_hardening.sql','utf8'))
 await rejects(()=>as(actors.admin,'SELECT generar_folio_queja()'),'42501','Folio solo por alta transaccional')
 check((await pool.query('SELECT count(*)::int n FROM queja_mail_outbox')).rows[0].n===0,'Sin correos retroactivos')
 for(const a of [actors.inactive,actors.denied])await rejects(()=>newCase(a),'42501','Alta no autorizada')
 await rejects(()=>newCase(null),'42501','Alta sin identidad')
 await rejects(()=>newCase(actors.admin,'a@example.test,b@example.test'),'22023','Un único correo')
 let c=await newCase();check(c.tipo==='Observación'&&c.fecha_recepcion_gc&&c.prioridad===null,'Metadatos automáticos y sin prioridad')
 const date=c.fecha_recepcion_gc
 const areas=await Promise.all([as(actors.admin,"SELECT public.qms_save_complaint_area('Innovación y TI') value"),as(actors.quality,"SELECT public.qms_save_complaint_area('Innovación y TI') value")])
 check(areas[0][0].value.id===areas[1][0].value.id,'Creación concurrente de área única')
 c=await register(c,'Innovación y TI','ECA-GC-2026-001')
 check(c.fecha_recepcion_gc===date&&c.tipo==='Observación','Editar GC conserva fecha/tipo')
 await rejects(()=>register({...c,revision:c.revision-1},null,'otro'),'40001','Revisión obsoleta')
 await rejects(()=>register(c,'Área inexistente',null),'22023','Área fuera de catálogo')
 const race=await Promise.allSettled([register(c,null,'ECA-GC-2026-001'),register(c,null,'ECA-GC-2026-001')])
 check(race.filter(x=>x.status==='fulfilled').length===1&&race.some(x=>x.reason?.code==='40001'),'Dos guardados no se pisan')
 c=(await pool.query('SELECT to_jsonb(v) value FROM qms_quejas v WHERE id=$1',[c.id])).rows[0].value
 let duplicate=await newCase();await rejects(()=>register(duplicate,null,' eca-gc-2026-001 '),'23505','Oficio único normalizado')
 await rejects(()=>transition(c,'investigation',{justification:'Procede',owner:actors.owner.id},actors.other),'42501','Otro colaborador no decide')
 c=await transition(c,'investigation',{justification:'**Procede**',owner:actors.owner.id})
 check(c.justificacion_procede==='**Procede**'&&c.justificacion_procede_formato==='markdown','Justificación guarda formato explícito')
 const deadline=c.plazo_vence,stageRun=(await pool.query("SELECT id FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL",[c.id])).rows[0].id
 c=await transition(c,'quality_review',{resolution:'**Resultado**'},actors.owner)
 check(c.plazo_vence===deadline,'Revisión GC conserva vencimiento')
 c=await transition(c,'investigation')
 check(c.plazo_vence===deadline&&(await pool.query('SELECT id FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL',[c.id])).rows[0].id===stageRun,'Devolver no reinicia ejecución')
 c=await transition(c,'resolved',{resolution:'Resultado final'})
 c=await transition(c,'finished')
 check((await pool.query('SELECT count(*)::int n FROM queja_mail_outbox WHERE queja_id=$1',[c.id])).rows[0].n===3,'Exactamente tres eventos sin cuarto Finalizado')
 c=await transition(c,'investigation',{reopen:'Nuevo hecho'})
 check((await pool.query('SELECT id FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL',[c.id])).rows[0].id!==stageRun,'Reapertura real usa ejecución nueva')
 check((await pool.query('SELECT count(*)::int n FROM queja_mail_outbox WHERE queja_id=$1',[c.id])).rows[0].n===3,'Reapertura no duplica los tres avisos')
 await rejects(()=>transition(duplicate,'rejected',{resolution:'No procede'}),'22023','No procede requiere oficio')
 duplicate=await transition(duplicate,'rejected',{resolution:'No procede',office:'ECA-GC-2026-002'})
 check((await pool.query('SELECT count(*)::int n FROM queja_mail_outbox WHERE queja_id=$1',[duplicate.id])).rows[0].n===2,'No procede tiene recibido y final')
 await rejects(()=>as(actors.admin,'UPDATE quejas SET estado=$1 WHERE id=$2',['Resuelto',c.id]),'42501','Sin escritura directa')
 await rejects(()=>as(null,'SELECT * FROM qms_quejas',[],'anon'),'42501','Sin lectura anónima')
 check((await as(actors.other,'SELECT * FROM qms_quejas')).length===0,'Otro colaborador no lee expediente')
 await rejects(()=>as(actors.admin,'SELECT destinatario FROM queja_mail_outbox'),'42501','Cola no expone destinatario')
 check((await as(actors.admin,'SELECT id,status FROM queja_mail_outbox')).length===5,'GC puede leer resultados de correo')
 check((await as(actors.inactive,'SELECT id,status FROM queja_mail_outbox')).length===0,'Inactivo sin resultados')
 await pool.query("UPDATE permisos SET leer=false,escribir=false WHERE rol='calidad' AND modulo='quejas'")
 check((await as(actors.quality,'SELECT id FROM qms_quejas')).length===0,'Calidad sin permiso de módulo no lee')
 await rejects(()=>as(actors.quality,'SELECT qms_update_details($1,$2,NULL,NULL,NULL,NULL)',[c.id,c.revision]),'42501','Calidad sin permiso de módulo no escribe')
 await pool.query("UPDATE permisos SET leer=true,escribir=true WHERE rol='calidad' AND modulo='quejas'")
 await rejects(()=>as(actors.admin,'SELECT * FROM qms_mail_claim_batch(1,120,$1,$2)',[randomUUID(),Math.floor(Date.now()/1000)]),'42501','Worker no ejecutable por cliente')
 await rejects(()=>claim(randomUUID(),1,null),'22023','Lease NULL rechazado')
 const nonce=randomUUID(),batch=await claim(nonce)
 check(batch.length>0&&batch.length<=5,'Worker reclama lote acotado')
 check((await claim(nonce)).length===0,'Replay nonce rechazado entre instancias')
 const token=batch[0].claim_token,id=batch[0].id
 check((await as(null,'SELECT qms_mail_complete($1,$2,$3,300,NULL) value',[id,randomUUID(),'sent'],'service_role'))[0].value===false,'ACK de otra reserva no confirma')
 check((await as(null,'SELECT qms_mail_complete($1,$2,$3,300,NULL) value',[id,token,'sent'],'service_role'))[0].value===true,'ACK propio confirma')
 check((await as(null,'SELECT qms_mail_complete($1,$2,$3,300,NULL) value',[id,token,'sent'],'service_role'))[0].value===false,'ACK repetido no confirma')
 await pool.query("UPDATE queja_mail_outbox SET lease_until=now()-interval '1 second' WHERE status='leased'")
 await claim()
 check((await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE status='uncertain'")).rows[0].n===batch.length-1,'Lease vencido no causa reenvío')
 for(let i=0;i<12;i++)await newCase()
 const parallel=await Promise.all([claim(),claim()]);check(new Set(parallel.flat().map(x=>x.id)).size===parallel.flat().length,'Workers concurrentes no comparten eventos')
 const form=randomUUID(),sid=randomUUID(),formToken='a'.repeat(32)
 await pool.query("INSERT INTO formularios_publicos VALUES($1,$2,true,'quejas')",[form,formToken])
 const publicArgs=[form,formToken,sid,'b'.repeat(64),'c'.repeat(64),'Prueba pública','person@example.test','','Observación','Detalle ficticio']
 const submit=()=>as(null,'SELECT public_form_create_submission($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value',publicArgs,'service_role')
 const submitted=(await submit())[0].value
 check(submitted.created===true,'Gateway público acepta Observación')
 check((await submit())[0].value.created===false,'Gateway conserva idempotencia')
 check((await pool.query('SELECT tipo FROM quejas WHERE id=$1',[submitted.queja_id])).rows[0].tipo==='Observación','Tipo automático del formulario')
 const assigned=(await as(actors.admin,'SELECT public.qms_update_details($1,$2,NULL,NULL,$3,NULL) value',[c.id,c.revision,actors.other.id]))[0].value
 check(assigned.responsable_id===actors.other.id&&assigned.revision>c.revision,'Admin puede reasignar con revisión vigente')
 check(assigned.plazo_vence===c.plazo_vence,'Reasignar no reinicia ni cambia el plazo')
 console.log(JSON.stringify({ok:true,checks,scope:'Quejas workflow + mail outbox; isolated PostgreSQL; no remote writes'}))
 fs.writeFileSync(path.join(root,'.performance/quejas-db-evidence.json'),JSON.stringify({ok:true,checks,at:new Date().toISOString()},null,2))
} finally {if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-w','stop','-m','fast'])}


