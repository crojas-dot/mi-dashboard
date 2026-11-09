// Reproduce SQL/ACL con identidades ficticias. No carga .env ni llama al proyecto remoto.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const root=process.cwd(), bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin'
const work=path.join(root,'.performance','quejas-internal-db-'+Date.now()), data=path.join(work,'data'),port=55454
const {Pool}=createRequire(path.join(root,'.performance/load-tools/package.json'))('pg')
const password=randomBytes(32).toString('hex');let pool,started=false,checks=0
const schema=JSON.parse(fs.readFileSync('supabase/backups/quejas_workflow_schema_20261010.json','utf8'))
const section=n=>schema.find(x=>x.section===n).data
const q=(value)=>'"'+value.replaceAll('"','""')+'"'
function run(binary,args){const r=spawnSync(path.join(bin,binary),args,{encoding:'utf8',stdio:'pipe',windowsHide:true,timeout:60000});if(r.status!==0)throw new Error('PostgreSQL fixture command failed: '+binary+' '+r.stderr)}
function check(c,m){assert.ok(c,m);checks++}
async function rejects(fn,code,m){await assert.rejects(fn,e=>e.code===code,m);checks++}
async function as(actor,sql,args=[],role='authenticated'){const c=await pool.connect();try{await c.query('SET ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor?.auth??'']);return(await c.query(sql,args)).rows}finally{await c.query('RESET ROLE');c.release()}}
const actors=Object.fromEntries(['admin','quality','quality2','owner','other','inactive','denied'].map(k=>[k,{id:randomUUID(),auth:randomUUID()}]))
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
 CREATE TABLE usuarios(id uuid PRIMARY KEY,auth_id uuid,rol text,estado text,email text NOT NULL);
 CREATE TABLE permisos(rol text,modulo text,leer boolean,escribir boolean);
 CREATE TABLE logs(id uuid DEFAULT gen_random_uuid(),fecha timestamptz,usuario_id uuid,accion text,modulo text,detalle text);
 CREATE TABLE notificaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario_id uuid,fecha timestamptz,tipo text,mensaje text,enlace text,origen_id text,leida boolean DEFAULT false,archivada boolean DEFAULT false);
 CREATE TABLE folios_quejas_anuales(anio integer PRIMARY KEY,ultimo integer);
 CREATE TABLE qms_config_audit(id bigint GENERATED ALWAYS AS IDENTITY,entity text NOT NULL,old_value jsonb,new_value jsonb NOT NULL,reason text,actor_id uuid,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE qms_case_events(id bigint GENERATED ALWAYS AS IDENTITY,module text,case_id uuid,kind text,occurred_at timestamptz,provenance text DEFAULT 'observed');
 CREATE TABLE qms_deadline_notices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid,offset_days integer,due_at timestamptz NOT NULL,processed_at timestamptz,UNIQUE(run_id,offset_days));`)
 for(const table of ['quejas','catalogos','qms_calendars','qms_stages','qms_stage_versions','qms_stage_runs']) {
   const cols=section('columns').filter(x=>x.table_name===table)
   const ddl=cols.map(x=>`${q(x.column_name)} ${x.data_type==='ARRAY'?'integer[]':x.data_type}${x.column_name==='id'&&x.data_type==='bigint'?' GENERATED BY DEFAULT AS IDENTITY':x.column_default?' DEFAULT '+x.column_default:''}${x.is_nullable==='NO'?' NOT NULL':''}`).join(',')
   await pool.query(`CREATE TABLE public.${q(table)} (${ddl})`)
   if(['qms_calendars','qms_stage_versions','qms_stages'].includes(table)) await pool.query(`ALTER TABLE ${q(table)} ADD PRIMARY KEY(id)`)
 }
 for(const c of [...section('constraints')].sort((a,b)=>Number(a.definition.startsWith('FOREIGN'))-Number(b.definition.startsWith('FOREIGN'))))await pool.query(`ALTER TABLE public.${q(c.table)} ADD CONSTRAINT ${q(c.name)} ${c.definition}`)
 for(const [name,a]of Object.entries(actors))await pool.query('INSERT INTO usuarios VALUES($1,$2,$3,$4,$5)',[a.id,a.auth,['quality','quality2'].includes(name)?'calidad':['owner','other'].includes(name)?'colaborador':name==='denied'?'calidad':'admin',name==='inactive'?'inactivo':'activo',name+'@example.test'])
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
 await pool.query(`CREATE UNIQUE INDEX qms_one_active_run ON qms_stage_runs(case_id) WHERE ended_at IS NULL;
   CREATE INDEX qms_notices_due ON qms_deadline_notices(due_at) WHERE processed_at IS NULL;
   ALTER TABLE qms_deadline_notices ADD CONSTRAINT qms_deadline_notices_run_id_fkey FOREIGN KEY(run_id) REFERENCES qms_stage_runs(id);`)
 const producers=JSON.parse(fs.readFileSync('supabase/backups/internal_notices_producers_20261014.json','utf8'))
 await pool.query(fs.readFileSync('supabase/migrations/20261011044303_quejas_workflow_completion.sql','utf8'))
 await pool.query(fs.readFileSync('supabase/migrations/20261011044317_quejas_mail_outbox.sql','utf8'))
 await pool.query(fs.readFileSync('supabase/migrations/20261011044810_quejas_rpc_surface_hardening.sql','utf8'))
 await pool.query('CREATE TABLE public_form_uploads(form_id uuid,submission_id uuid,status text)')
 await pool.query(producers.functions.find(x=>x.name==='public_form_finalize_submission').body)
 const historical=await newCase()
 let historicalInvest=await newCase()
 historicalInvest=await transition(historicalInvest,'investigation',{justification:'Histórico ficticio',owner:actors.owner.id})
 const oldInvest=(await pool.query('SELECT id,expires_at,snapshot FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL',[historicalInvest.id])).rows[0]
 const before=(await pool.query('SELECT expires_at,snapshot FROM qms_stage_runs WHERE case_id=$1',[historical.id])).rows[0]
 await pool.query(fs.readFileSync('supabase/migrations/20261015011028_quejas_internal_notices.sql','utf8'))
 const count=async(kind,caseId)=>(await pool.query('SELECT count(*)::int n FROM queja_mail_outbox WHERE tipo=$1 AND ($2::uuid IS NULL OR queja_id=$2)',[kind,caseId??null])).rows[0].n
 const enable=async(value)=>(await as(null,'SELECT qms_set_internal_notices($1) value',[value],'service_role'))[0].value
 const dispatch=async()=>(await as(null,'SELECT qms_process_notices() value',[],'service_role'))[0].value
 const claimV2=async(nonce=randomUUID(),limit=5)=>(await as(null,'SELECT * FROM qms_mail_claim_batch_v2($1,120,$2,$3)',[limit,nonce,Math.floor(Date.now()/1000)],'service_role'))
 const authorize=async(row,token=row.claim_token)=>(await as(null,'SELECT qms_mail_authorize($1,$2) value',[row.id,token],'service_role'))[0].value
 const complete=async(row,outcome='sent',code=null)=>(await as(null,'SELECT qms_mail_complete($1,$2,$3,300,$4) value',[row.id,row.claim_token,outcome,code],'service_role'))[0].value
 const pending=async()=>{await pool.query("UPDATE queja_mail_outbox SET status='sent',sent_at=now(),claim_token=NULL,lease_until=NULL WHERE status IN ('pending','retry')")}
 check((await pool.query('SELECT enabled FROM qms_internal_notice_settings')).rows[0].enabled===false,'Installed disabled')
 check(await count('interno_recibido')===0&&await dispatch()===0,'No retroactive receipts or deadline dispatch')
 const disabled=await newCase()
 check(await count('interno_recibido',disabled.id)===0,'Disabled producer keeps citizen-only outbox')
 check((await pool.query("SELECT count(*)::int n FROM notificaciones WHERE tipo='queja_nueva' AND origen_id=$1",[disabled.id])).rows[0].n===3,'Disabled mode retains admin/Calidad bells')
 check((await pool.query("SELECT alerts FROM qms_stage_versions WHERE stage_id='quejas.investigation' ORDER BY id DESC LIMIT 1")).rows[0].alerts.join(',')==='5,3','Future investigation rule publishes 5/3')
 const after=(await pool.query('SELECT expires_at,snapshot FROM qms_stage_runs WHERE case_id=$1',[historical.id])).rows[0]
 check(after.expires_at.toISOString()===before.expires_at.toISOString()&&JSON.stringify(after.snapshot)===JSON.stringify(before.snapshot),'Migration preserves historical deadline and snapshot')
 await rejects(()=>as(actors.admin,'SELECT qms_set_internal_notices(true)'),'42501','UI cannot activate')
 await rejects(()=>as(actors.admin,'SELECT * FROM qms_internal_notice_settings'),'42501','Settings private')
 await rejects(()=>as(actors.admin,'SELECT usuario_id,run_id,event_key FROM queja_mail_outbox'),'42501','Operational identities private')
 await rejects(()=>as(actors.admin,'SELECT qms_mail_authorize($1,$2)',[randomUUID(),randomUUID()]),'42501','Authorize service-only')
 const cutoff=await enable(true)
 check(cutoff instanceof Date&&cutoff.getTime()>=before.expires_at.getTime()-30*86400000,'Activation resets real cutoff')
 check(await count('interno_recibido')===0,'Activation does not backfill old receipts')
 check((await pool.query('SELECT count(*)::int n FROM qms_deadline_notices WHERE run_id=$1 AND offset_days=5 AND due_at>$2',[oldInvest.id,cutoff])).rows[0].n===1,'Activation schedules future five-day warning for existing business-day run')
 const investAfter=(await pool.query('SELECT expires_at,snapshot FROM qms_stage_runs WHERE id=$1',[oldInvest.id])).rows[0]
 check(investAfter.expires_at.toISOString()===oldInvest.expires_at.toISOString()&&JSON.stringify(investAfter.snapshot)===JSON.stringify(oldInvest.snapshot),'Future replan never changes existing investigation deadline/snapshot')
 check((await enable(true)).toISOString()===cutoff.toISOString(),'Already-enabled call preserves cutoff')
 let c=await newCase()
 check(await count('interno_recibido',c.id)===2,'All active Calidad receive, admin does not receive internal email')
 check((await pool.query("SELECT count(*)::int n FROM notificaciones WHERE origen_id=$1 AND tipo='queja_nueva'",[c.id])).rows[0].n===3,'Quality and existing admin bell occur once')
 check(await count('recibido',c.id)===1,'Citizen receipt preserved')
 await as(null,'SELECT notificar_queja_publica($1)',[c.folio],'service_role')
 check(await count('interno_recibido',c.id)===2,'Repeated finalize cannot duplicate reception')
 await pool.query("UPDATE notificaciones SET leida=true,archivada=true WHERE origen_id=$1",[c.id])
 await as(null,'SELECT notificar_queja_publica($1)',[c.folio],'service_role')
 check(await count('interno_recibido',c.id)===2,'Read/archive cannot reset deduplication')
 await rejects(()=>transition({...c,revision:c.revision-1},'investigation',{justification:'Texto',owner:actors.owner.id}),'40001','CAS failure causes no assignment')
 check(await count('interno_asignacion',c.id)===0,'Failed transition no assignment side effects')
 c=await transition(c,'investigation',{justification:'Texto',owner:actors.owner.id})
 check(await count('interno_asignacion',c.id)===1,'Assigning active owner creates email')
 check((await pool.query("SELECT count(*)::int n FROM notificaciones WHERE origen_id=$1 AND usuario_id=$2 AND tipo IN ('queja_estado','interno_asignacion')",[c.id,actors.owner.id])).rows[0].n===1,'Assignment suppresses duplicate legacy state bell')
 const due=c.plazo_vence,stageRun=(await pool.query('SELECT id FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL',[c.id])).rows[0].id
 c=await transition(c,'quality_review',{resolution:'Resultado'},actors.owner)
 c=await transition(c,'investigation')
 check(c.plazo_vence===due&&(await pool.query('SELECT id FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL',[c.id])).rows[0].id===stageRun,'GC return preserves deadline and run')
 check(await count('interno_asignacion',c.id)===1,'Return to investigation does not reassign')
 await pending()
 // Frozen recipient must match the current directory at delivery time.
 await newCase()
 await pool.query("UPDATE queja_mail_outbox SET status='sent' WHERE tipo IN ('recibido','investigacion','final')")
 let rows=await claimV2(),target=rows.find(x=>x.tipo==='interno_recibido')
 check(!!target&&await authorize(target),'Valid internal lease authorized')
 const recipientUser=(await pool.query('SELECT usuario_id FROM queja_mail_outbox WHERE id=$1',[target.id])).rows[0].usuario_id
 check(await authorize(target,randomUUID())===false,'Claim token is exact')
 await pool.query("UPDATE usuarios SET email='changed@example.test' WHERE id=$1",[recipientUser])
 check(await authorize(target)===false,'Email change makes frozen recipient obsolete')
 check(await complete(target,'skipped','obsolete_notice'),'Obsolete internal can be terminal skipped')
 check(await complete(target,'skipped','obsolete_notice')===false,'Repeated ACK not accepted')
 for(const row of rows.filter(x=>x.id!==target.id))await complete(row)
 await pool.query('UPDATE usuarios SET email=$1 WHERE id=$2',[recipientUser===actors.quality.id?'quality@example.test':'quality2@example.test',recipientUser])
 await pending()
 // A -> B -> A: old A may have a valid lease, but cannot become current again.
 let assigned=await newCase()
 assigned=await transition(assigned,'investigation',{justification:'Texto',owner:actors.owner.id})
 await pool.query("UPDATE queja_mail_outbox SET status='sent' WHERE tipo<>'interno_asignacion'")
 const first=(await claimV2()).find(x=>x.tipo==='interno_asignacion')
 check(!!first&&await authorize(first),'First assignment authorized')
 const reassign=async(caseValue,owner)=>(await as(actors.admin,'SELECT qms_update_details($1,$2,NULL,NULL,$3,NULL) value',[caseValue.id,caseValue.revision,owner]))[0].value
 assigned=await reassign(assigned,actors.other.id)
 check(await authorize(first)===false,'Previous owner rejected after reassignment')
 assigned=await reassign(assigned,actors.owner.id)
 check(await authorize(first)===false,'A-B-A never revives old A generation')
 await complete(first,'skipped','obsolete_notice')
 rows=await claimV2()
 const latest=rows.find(x=>x.tipo==='interno_asignacion'&&x.destinatario==='owner@example.test')
 check(!!latest&&await authorize(latest),'Newest A generation is eligible')
 check(rows.filter(x=>x.tipo==='interno_asignacion').length===1,'Stale assignment generations are skipped before claiming')
 const changed=await register(assigned,'Innovación y TI',null).catch(async()=>{
   await as(actors.admin,"SELECT qms_save_complaint_area('Innovación y TI')")
   return register(assigned,'Innovación y TI',null)
 })
 check(await authorize(latest),'Editing area does not invalidate assignment generation')
 assigned=changed
 for(const row of rows)await complete(row,(await authorize(row))?'sent':'skipped',(await authorize(row))?null:'obsolete_notice')
 await pending()
 // Public registration must wait for finalized attachments.
 const form=randomUUID(),sid=randomUUID(),token='a'.repeat(32)
 await pool.query("INSERT INTO formularios_publicos VALUES($1,$2,true,'quejas')",[form,token])
 const args=[form,token,sid,'b'.repeat(64),'c'.repeat(64),'Persona ficticia','person@example.test','','Queja','Detalle ficticio']
 const pub=(await as(null,'SELECT public_form_create_submission($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value',args,'service_role'))[0].value
 check(await count('interno_recibido',pub.queja_id)===0,'Public INSERT does not notify Calidad before evidence finalization')
 await pool.query("INSERT INTO public_form_uploads VALUES($1,$2,'reserved')",[form,sid])
 await rejects(()=>as(null,'SELECT public_form_finalize_submission($1,$2,$3)',[form,sid,pub.queja_id],'service_role'),'23505','Reserved evidence prevents finalize')
 await pool.query("UPDATE public_form_uploads SET status='committed' WHERE form_id=$1 AND submission_id=$2",[form,sid])
 await as(null,'SELECT public_form_finalize_submission($1,$2,$3)',[form,sid,pub.queja_id],'service_role')
 check(await count('interno_recibido',pub.queja_id)===2,'Finalization notifies Calidad after evidence')
 await as(null,'SELECT public_form_finalize_submission($1,$2,$3)',[form,sid,pub.queja_id],'service_role')
 check(await count('interno_recibido',pub.queja_id)===2,'Finalize replay deduped')
 await pending()
 // Calendar arithmetic uses persisted business days and holidays, never N*24h.
 await pool.query("UPDATE qms_calendars SET holidays='[{\"date\":\"2026-10-12\",\"description\":\"Fixture\"}]'::jsonb WHERE id=1")
 check((await pool.query("SELECT qms_complaint_notice_due('2026-10-16T05:59:59.999999Z',3,'business_days',1) d")).rows[0].d.toISOString()==='2026-10-09T12:00:00.000Z','Three-business-day warning skips holiday/weekend')
 await pool.query("INSERT INTO qms_calendars(id,weekdays) VALUES(2,ARRAY[1,2,3,4,5,6,7])")
 // Simulate an activation made two days ago, without changing the wall clock or external services.
 await pool.query("UPDATE qms_internal_notice_settings SET cutoff_at=now()-interval '2 days'")
 const prepare=async(stage,offset,owner=actors.owner.id)=>{
   let q=await newCase();if(stage==='quejas.investigation')q=await transition(q,'investigation',{justification:'Texto',owner})
   const r=(await pool.query('SELECT id FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL',[q.id])).rows[0]
   await pool.query("UPDATE qms_stage_runs SET expires_at=CASE WHEN $2=0 THEN now()-interval '1 minute' ELSE qms_due(now(),$2,'business_days',2) END WHERE id=$1",[r.id,offset])
   await pool.query('DELETE FROM qms_deadline_notices WHERE run_id=$1',[r.id])
   await pool.query("INSERT INTO qms_deadline_notices(run_id,offset_days,due_at) VALUES($1,$2,now()-interval '30 seconds')",[r.id,offset])
   return {...q,run:r.id}
 }
 for(const [stage,offset,kind,expected]of [
   ['quejas.evaluation',1,'interno_evaluacion_1',2],
   ['quejas.investigation',5,'interno_investigacion_5',2],
   ['quejas.investigation',3,'interno_investigacion_3',3],
   ['quejas.evaluation',0,'interno_evaluacion_vencida',2],
   ['quejas.investigation',0,'interno_investigacion_vencida',3],
 ]){
   const q=await prepare(stage,offset)
   await Promise.all([dispatch(),dispatch()])
   check(await count(kind,q.id)===expected,kind+' correct active recipients and concurrent dedup')
   await dispatch();check(await count(kind,q.id)===expected,kind+' repeat is idempotent')
 }
 const silentTick=await prepare('quejas.investigation',3)
 const leasedBefore=(await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE status='leased'")).rows[0].n
 const zeroBatch=await claimV2(randomUUID(),0)
 check(zeroBatch.length===0&&await count('interno_investigacion_3',silentTick.id)===3,'Zero-limit tick still dispatches campanas/outbox')
 check((await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE status='leased'")).rows[0].n===leasedBefore,'Zero-limit tick does not lease emails')
 const atomic=await prepare('quejas.evaluation',1)
 await pool.query("ALTER TABLE notificaciones ADD CONSTRAINT qms_fixture_reject_notice CHECK(tipo<>'interno_evaluacion_1') NOT VALID")
 await rejects(()=>dispatch(),'23514','Campana failure rolls back the whole deadline dispatch')
 check(await count('interno_evaluacion_1',atomic.id)===0&&(await pool.query('SELECT processed_at FROM qms_deadline_notices WHERE run_id=$1 AND offset_days=1',[atomic.run])).rows[0].processed_at===null,'No partial mail or processed marker survives failed transaction')
 await pool.query('ALTER TABLE notificaciones DROP CONSTRAINT qms_fixture_reject_notice')
 await dispatch();check(await count('interno_evaluacion_1',atomic.id)===2,'Atomic retry produces one campana/mail per recipient')
 const overlap=await prepare('quejas.investigation',3,actors.quality.id)
 await dispatch();check(await count('interno_investigacion_3',overlap.id)===2,'Calidad/responsible overlap gets one email')
 const inactive=await prepare('quejas.investigation',3)
 await pool.query("UPDATE usuarios SET estado='inactivo' WHERE id=$1",[actors.owner.id])
 await dispatch();check(await count('interno_investigacion_3',inactive.id)===2,'Inactive owner excluded')
 await pool.query("UPDATE usuarios SET estado='activo' WHERE id=$1",[actors.owner.id])
 const inactiveQuality=await prepare('quejas.investigation',5)
 await pool.query("UPDATE usuarios SET estado='inactivo' WHERE id=$1",[actors.quality2.id])
 await dispatch();check(await count('interno_investigacion_5',inactiveQuality.id)===1,'Inactive Calidad excluded from internal email')
 await pool.query("UPDATE usuarios SET estado='activo' WHERE id=$1",[actors.quality2.id])
 const obsolete=await prepare('quejas.investigation',3)
 await pool.query("UPDATE qms_stage_runs SET ended_at=now(),end_event='Resuelto' WHERE id=$1",[obsolete.run])
 await dispatch();check(await count('interno_investigacion_3',obsolete.id)===0,'Closed run not dispatched')
 const legacy=await prepare('quejas.investigation',3)
 await pool.query("UPDATE qms_stage_runs SET provenance='legacy_unknown',snapshot=jsonb_set(snapshot,'{rule,day_type}','\"calendar_days\"') WHERE id=$1",[legacy.run])
 await dispatch();check(await count('interno_investigacion_3',legacy.id)===0,'Unknown/calendar-day legacy is not called business days')
 const late=await prepare('quejas.investigation',0)
 await pool.query("INSERT INTO qms_deadline_notices(run_id,offset_days,due_at) VALUES($1,5,now()-interval '1 day'),($1,3,now()-interval '1 day')",[late.run])
 await dispatch();check(await count('interno_investigacion_5',late.id)===0&&await count('interno_investigacion_3',late.id)===0&&await count('interno_investigacion_vencida',late.id)===3,'Late worker keeps only overdue milestone')
 const budget=await newCase(),budgetRun=(await pool.query('SELECT id FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL',[budget.id])).rows[0].id
 await pool.query("INSERT INTO qms_deadline_notices(run_id,offset_days,due_at) SELECT $1,a,now()-interval '1 second' FROM generate_series(6,305) a",[budgetRun])
 await dispatch()
 check((await pool.query('SELECT count(*)::int n FROM qms_deadline_notices WHERE run_id=$1 AND offset_days>=6 AND processed_at IS NOT NULL',[budgetRun])).rows[0].n===250,'One case cannot exceed global 250-notice budget')
 await dispatch()
 check((await pool.query('SELECT count(*)::int n FROM qms_deadline_notices WHERE run_id=$1 AND offset_days>=6 AND processed_at IS NOT NULL',[budgetRun])).rows[0].n===300,'Remaining backlog continues in following tick')
 await pending()
 let closing=await newCase();closing=await transition(closing,'investigation',{justification:'Texto',owner:actors.owner.id})
 await pool.query("UPDATE queja_mail_outbox SET status='sent' WHERE tipo<>'interno_asignacion'")
 const closingLease=(await claimV2()).find(x=>x.tipo==='interno_asignacion')
 check(!!closingLease&&await authorize(closingLease),'Current run lease is eligible before close')
 await transition(closing,'resolved',{resolution:'Resultado',office:'ECA-GC-2026-999'})
 check(await authorize(closingLease)===false,'Close makes existing lease obsolete before send')
 await complete(closingLease,'skipped','obsolete_notice')
 await pending()
 await newCase();const nonce=randomUUID(),batch=await claimV2(nonce)
 check(batch.length>0&&batch.length<=5,'Bounded v2 batch')
 check((await claimV2(nonce)).length===0,'v2 nonce replay cannot dispatch/claim again')
 for(const row of batch)await complete(row)
 for(let i=0;i<5;i++)await newCase()
 const concurrent=await Promise.all([claimV2(),claimV2()])
 check(new Set(concurrent.flat().map(x=>x.id)).size===concurrent.flat().length,'Concurrent v2 workers never share event')
 await pool.query("UPDATE queja_mail_outbox SET lease_until=now()-interval '1 second' WHERE status='leased'")
 await claimV2()
 check((await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE status='uncertain'")).rows[0].n===concurrent.flat().length,'Expired leases become uncertain and are never retried blindly')
 await pending();await newCase()
 const oldBatch=await claim()
 check(oldBatch.every(x=>!x.tipo.startsWith('interno_')),'Legacy worker only sees citizen snapshots')
 for(const row of oldBatch)check(await complete(row,'skipped','obsolete_notice')===false,'Citizen cannot be skipped by internal protocol')
 await enable(false)
 check(await dispatch()===0,'Disabling stops internal dispatch')
 const oldCutoff=(await pool.query('SELECT cutoff_at FROM qms_internal_notice_settings')).rows[0].cutoff_at
 const reenabled=await enable(true)
 check(reenabled>oldCutoff,'Reactivation establishes fresh cutoff')
 check((await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE tipo IN ('recibido','investigacion','final')")).rows[0].n>0,'Citizen outbox remains intact throughout')
 const baselineChecks=checks
 // La ampliación se ejecuta después del baseline anterior: no reemplaza sus
 // comprobaciones de destinatarios, plazos, concurrencia o autorización interna.
 // Instalar solo el segmento real de snapshot/v3 evita simular su proyección y no
 // incorpora el resto del contrato de publicación/Drive a esta fixture de correo.
 const trackingMigration=fs.readFileSync('supabase/migrations/20261015223440_quejas_public_tracking.sql','utf8')
 const trackingFunction=name=>{
   const start=trackingMigration.indexOf('CREATE FUNCTION public.'+name+'(')
   const end=trackingMigration.indexOf('$function$;',start)+'$function$;'.length
   assert.ok(start>=0&&end>start,'Tracking function must exist in the real migration')
   return trackingMigration.slice(start,end)
 }
 await pool.query(trackingMigration.slice(trackingMigration.indexOf('CREATE TABLE public.queja_public_access'),trackingMigration.indexOf('CREATE TABLE public.queja_public_resolutions')))
 await pool.query('ALTER TABLE public.queja_public_access ENABLE ROW LEVEL SECURITY;REVOKE ALL ON public.queja_public_access FROM PUBLIC,anon,authenticated;GRANT ALL ON public.queja_public_access TO service_role')
 await pool.query(trackingFunction('qms_ensure_public_tracking_access'))
 await pool.query('ALTER TABLE public.queja_mail_outbox ADD COLUMN public_tracking jsonb')
 await pool.query(trackingFunction('qms_snapshot_public_tracking_mail'))
 await pool.query('CREATE TRIGGER qms_snapshot_public_tracking_mail BEFORE INSERT ON public.queja_mail_outbox FOR EACH ROW EXECUTE FUNCTION public.qms_snapshot_public_tracking_mail()')
 await pool.query(trackingFunction('qms_mail_claim_batch_v3'))
 await pool.query('REVOKE ALL ON FUNCTION public.qms_ensure_public_tracking_access(uuid),public.qms_snapshot_public_tracking_mail(),public.qms_mail_claim_batch_v3(integer,integer,uuid,bigint) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.qms_ensure_public_tracking_access(uuid),public.qms_mail_claim_batch_v3(integer,integer,uuid,bigint) TO service_role')
 const queueRow=async(caseId,kind)=>(await pool.query('SELECT * FROM queja_mail_outbox WHERE queja_id=$1 AND tipo=$2',[caseId,kind])).rows[0]
 const freeze=async()=>pool.query("UPDATE queja_mail_outbox SET next_attempt_at=now()+interval '1 day' WHERE status IN ('pending','retry')")
 const thaw=async id=>pool.query('UPDATE queja_mail_outbox SET next_attempt_at=now() WHERE id=$1',[id])
 const seed=[]
 for(const status of ['pending','retry','sent','uncertain','failed','leased']) {
   let value=await newCase()
   value=await transition(value,'investigation',{justification:'Histórico para la política anterior',owner:actors.owner.id})
   value=await transition(value,'resolved',{resolution:'Resultado histórico ficticio',office:'HIST-'+value.folio})
   await pool.query("UPDATE queja_mail_outbox SET status='sent',sent_at=now(),claim_token=NULL,lease_until=NULL WHERE queja_id=$1 AND tipo='recibido'",[value.id])
   await pool.query(`UPDATE queja_mail_outbox SET status=$2,attempts=2,
     claim_token=CASE WHEN $2='leased' THEN gen_random_uuid() END,
     lease_until=CASE WHEN $2='leased' THEN now()+interval '10 minutes' END,
     sent_at=CASE WHEN $2='sent' THEN now()-interval '1 hour' END,
     safe_error=CASE WHEN $2 IN ('retry','uncertain','failed') THEN 'fixture_delivery_state' END
     WHERE queja_id=$1 AND tipo='investigacion'`,[value.id,status])
   seed.push({caseId:value.id,status,original:await queueRow(value.id,'investigacion'),final:await queueRow(value.id,'final')})
 }
 const unchangedFunctions=['qms_mail_authorize','qms_mail_complete','qms_process_notices','qms_internal_delivery_eligible','qms_mail_claim_batch_v3','qms_snapshot_public_tracking_mail']
 const readFunctions=async names=>(await pool.query('SELECT oid::text,proname,pg_get_functiondef(oid) body,proacl::text,prosecdef,proconfig FROM pg_proc WHERE pronamespace=\'public\'::regnamespace AND proname=ANY($1::text[]) ORDER BY proname',[names])).rows
 const functionAcl=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='body')))
 const functionsBefore=await readFunctions(unchangedFunctions)
 const aclBefore=functionAcl(await readFunctions(['qms_enqueue_complaint_mail','qms_mail_claim_batch','qms_mail_claim_batch_v2']))
 const protectedBefore=(await pool.query("SELECT * FROM queja_mail_outbox WHERE tipo='investigacion' AND status NOT IN ('pending','retry') ORDER BY id")).rows
 const runsBefore=(await pool.query('SELECT id,case_id,expires_at,snapshot,ended_at FROM qms_stage_runs ORDER BY id')).rows
 const casesBefore=(await pool.query('SELECT id,folio,estado,revision,responsable_id,numero_oficio_resolucion FROM quejas ORDER BY id')).rows
 const policy=fs.readFileSync('supabase/migrations/20261020163142_quejas_two_citizen_mails.sql','utf8')
 await pool.query(policy)
 check(JSON.stringify(await readFunctions(unchangedFunctions))===JSON.stringify(functionsBefore),'Two-mail cut preserves authorize/complete/internal dispatch/v3/snapshot definitions and ACL')
 check(JSON.stringify(functionAcl(await readFunctions(['qms_enqueue_complaint_mail','qms_mail_claim_batch','qms_mail_claim_batch_v2'])))===JSON.stringify(aclBefore),'Replacing producer/claims preserves function identity, definer/search_path and ACL')
 check(JSON.stringify((await pool.query("SELECT * FROM queja_mail_outbox WHERE tipo='investigacion' AND status IN ('sent','uncertain','failed','leased') ORDER BY id")).rows)===JSON.stringify(protectedBefore),'Migration preserves sent/uncertain/failed/leased investigation rows byte for byte')
 check(JSON.stringify((await pool.query('SELECT id,case_id,expires_at,snapshot,ended_at FROM qms_stage_runs ORDER BY id')).rows)===JSON.stringify(runsBefore),'Mail policy never changes deadline snapshots or run history')
 check(JSON.stringify((await pool.query('SELECT id,folio,estado,revision,responsable_id,numero_oficio_resolucion FROM quejas ORDER BY id')).rows)===JSON.stringify(casesBefore),'Mail policy never updates complaint folios, revisions or workflow')
 for(const entry of seed.filter(item=>['pending','retry'].includes(item.status))) {
   const row=await queueRow(entry.caseId,'investigacion')
   check(row.status==='skipped'&&row.safe_error==='citizen_notice_retired'&&row.claim_token===null&&row.lease_until===null,'Only unreserved investigation is retired with an explicit terminal code')
   check(row.attempts===entry.original.attempts&&JSON.stringify(row.public_tracking)===JSON.stringify(entry.original.public_tracking)&&row.destinatario===entry.original.destinatario&&row.folio===entry.original.folio,'Retirement preserves attempts, recipient and frozen tracking snapshot')
 }
 const rowsAfterFirstCut=(await pool.query('SELECT * FROM queja_mail_outbox ORDER BY id')).rows
 await pool.query(policy)
 check(JSON.stringify((await pool.query('SELECT * FROM queja_mail_outbox ORDER BY id')).rows)===JSON.stringify(rowsAfterFirstCut),'Applying policy again does not resend, recreate or rewrite queue history')
 for(const role of ['anon','authenticated']) {
   for(const signature of ['qms_mail_claim_batch(integer,integer,uuid,bigint)','qms_mail_claim_batch_v2(integer,integer,uuid,bigint)','qms_mail_claim_batch_v3(integer,integer,uuid,bigint)','qms_mail_authorize(uuid,uuid)','qms_mail_complete(uuid,uuid,text,integer,text)'])check(!(await pool.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') value',[role,signature])).rows[0].value,'Mail RPC remains closed to '+role)
 }
 check((await pool.query("SELECT relrowsecurity value FROM pg_class WHERE oid='queja_mail_outbox'::regclass")).rows[0].value,'Outbox RLS remains enabled')
 await rejects(()=>as(actors.admin,'SELECT destinatario,claim_token,public_tracking FROM queja_mail_outbox'),'42501','Private queue fields remain unavailable to staff client')
 await rejects(()=>pool.query("UPDATE queja_mail_outbox SET status='skipped',safe_error='citizen_notice_retired' WHERE queja_id=$1 AND tipo='recibido'",[seed[0].caseId]),'23514','Retirement exception never permits skipping a receipt')
 await rejects(()=>pool.query("UPDATE queja_mail_outbox SET status='skipped',safe_error='citizen_notice_retired' WHERE queja_id=$1 AND tipo='final'",[seed[0].caseId]),'23514','Retirement exception never permits skipping final result')
 await rejects(()=>pool.query("UPDATE queja_mail_outbox SET safe_error=NULL WHERE queja_id=$1 AND tipo='investigacion'",[seed[0].caseId]),'23514','Retired investigation requires its exact non-null reason')
 await freeze()
 // Cada estado intermedio histórico deja de ser predecesor; recibido sigue siendo
 // requisito del resultado final y el lease histórico no se reaprovecha.
 for(const entry of seed) {
   await thaw(entry.final.id)
   const only=await claim(randomUUID(),1)
   check(only.length===1&&only[0].id===entry.final.id&&only[0].tipo==='final','Legacy final passes retired investigation with historical status '+entry.status)
   check(await complete(only[0]),'Legacy final completes with the existing CAS')
 }
 const leasedHistory=seed.find(item=>item.status==='leased')
 const held=await queueRow(leasedHistory.caseId,'investigacion')
 check(held.status==='leased'&&held.claim_token===leasedHistory.original.claim_token&&held.lease_until.toISOString()===leasedHistory.original.lease_until.toISOString(),'Old active lease is not cleared, reused or silently called skipped')
 check(await authorize(held)===false,'Internal authorization never authorizes the retired citizen investigation')
 let two=await newCase()
 check(await count('recibido',two.id)===1&&await count('interno_recibido',two.id)===2,'New policy retains client receipt and Calidad reception notices')
 two=await transition(two,'investigation',{justification:'Investigación vigente',owner:actors.owner.id})
 check(await count('investigacion',two.id)===0&&await count('interno_asignacion',two.id)===1,'Investigation creates assignment notice but no citizen intermediate email')
 const sameDue=two.plazo_vence
 two=await transition(two,'quality_review',{resolution:'Conclusión de prueba'},actors.owner)
 two=await transition(two,'investigation')
 check(two.plazo_vence===sameDue&&await count('interno_asignacion',two.id)===1&&await count('investigacion',two.id)===0,'Quality return keeps deadline and does not duplicate assignment/client mail')
 two=await transition(two,'resolved',{resolution:'Respuesta aprobada de prueba',office:'TWO-'+two.folio})
 two=await transition(two,'finished')
 check(await count('final',two.id)===1,'Resolution and finish create only one final email')
 two=await transition(two,'investigation',{reopen:'Reapertura ficticia justificada'})
 two=await transition(two,'resolved',{resolution:'Nueva conclusión interna de prueba',office:'TWO-'+two.folio})
 check(await count('recibido',two.id)===1&&await count('investigacion',two.id)===0&&await count('final',two.id)===1,'Reopening does not add a third citizen email')
 const receiptTwo=await queueRow(two.id,'recibido'),finalTwo=await queueRow(two.id,'final')
 check(!!receiptTwo.public_tracking&&JSON.stringify(receiptTwo.public_tracking)===JSON.stringify(finalTwo.public_tracking)&&Object.keys(finalTwo.public_tracking).sort().join(',')==='nonce,queja_id','Receipt/final retain the same minimal tracking snapshot under the unchanged trigger')
 let rejected=await newCase()
 rejected=await transition(rejected,'rejected',{resolution:'Motivo de no procedencia',office:'REJECT-'+rejected.folio})
 check(await count('recibido',rejected.id)===1&&await count('investigacion',rejected.id)===0&&await count('final',rejected.id)===1,'No Procede creates exactly receipt and final result')
 const rejectedFinal=await queueRow(rejected.id,'final')
 check(rejectedFinal.estado==='No Procede'&&rejectedFinal.numero_oficio==='REJECT-'+rejected.folio,'Final snapshot retains the approved state and institutional office')
 await freeze()
 await pool.query("UPDATE queja_mail_outbox SET status='uncertain',safe_error='fixture_delivery_state' WHERE id=$1",[receiptTwo.id])
 await thaw(finalTwo.id)
 check((await claim()).length===0,'An uncertain receipt still blocks the final email')
 await pool.query("UPDATE queja_mail_outbox SET status='sent',safe_error=NULL,sent_at=now() WHERE id=$1",[receiptTwo.id])
 const finalAfterReceipt=await claim()
 check(finalAfterReceipt.length===1&&finalAfterReceipt[0].id===finalTwo.id,'Confirming receipt releases final without re-sending any intermediate')
 await complete(finalAfterReceipt[0])
 // Incluso un INSERT privilegiado tardío del tipo retirado no puede escapar por
 // ningún claim; se conserva como evidencia, sin cambiar contrato de tipos histórico.
 const forbiddenCase=await newCase()
 await pool.query("INSERT INTO queja_mail_outbox(queja_id,tipo,destinatario,folio,estado) VALUES($1,'investigacion','fixture@example.test',$2,'En Investigación')",[forbiddenCase.id,forbiddenCase.folio])
 await freeze()
 const forbidden=await queueRow(forbiddenCase.id,'investigacion')
 await thaw(forbidden.id)
 check((await claim()).every(row=>row.tipo!=='investigacion'),'Legacy claim excludes a late privileged investigation insert')
 check((await claimV2()).every(row=>row.tipo!=='investigacion'),'v2 claim excludes a late privileged investigation insert')
 const claimV3=async(limit=5)=>(await as(null,'SELECT * FROM qms_mail_claim_batch_v3($1,120,$2,$3)',[limit,randomUUID(),Math.floor(Date.now()/1000)],'service_role'))
 check((await claimV3()).every(row=>row.tipo!=='investigacion'),'v3 wrapper excludes the retired type through v2')
 await freeze()
 const fresh=await newCase(),freshReceipt=await queueRow(fresh.id,'recibido')
 await freeze();await thaw(freshReceipt.id)
 const trackedBatch=await claimV3()
 check(trackedBatch.length===1&&trackedBatch[0].id===freshReceipt.id&&JSON.stringify(trackedBatch[0].public_tracking)===JSON.stringify(freshReceipt.public_tracking),'v3 claims a receipt with the immutable stored tracking snapshot')
 check(Object.keys(trackedBatch[0]).sort().join(',')==='claim_token,destinatario,estado,folio,id,numero_oficio,public_tracking,tipo','Two-mail cut does not expand the v3 payload')
 check(await complete(trackedBatch[0],'skipped','obsolete_notice')===false,'Existing skipped ACK remains internal-only')
 await rejects(()=>complete(trackedBatch[0],'skipped','citizen_notice_retired'),'22023','Worker cannot invoke administrative retirement via ACK')
 await complete(trackedBatch[0])
 await freeze()
 const currentInternal=await newCase()
 await pool.query("UPDATE queja_mail_outbox SET status='sent',sent_at=now() WHERE queja_id=$1 AND tipo='recibido'",[currentInternal.id])
 const assignmentBatch=await claimV2()
 check(assignmentBatch.length===2&&assignmentBatch.every(row=>row.tipo==='interno_recibido'),'v2 still claims all eligible Calidad reception notifications')
 for(const row of assignmentBatch) {
   check(await authorize(row),'Internal recipient/lease authorization remains effective after cut')
   await complete(row)
 }
 // La reactivación al final del baseline fijó un cutoff nuevo. El aviso sintético
 // vence treinta segundos atrás; simular otra vez un corte anterior evita tratarlo
 // como histórico y verifica el claim cero sin debilitar el filtro real.
 await pool.query("UPDATE qms_internal_notice_settings SET cutoff_at=now()-interval '2 days'")
 const warning=await prepare('quejas.investigation',3)
 const leasedBeforeTwo=(await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE status='leased'")).rows[0].n
 check((await claimV3(0)).length===0&&await count('interno_investigacion_3',warning.id)===3,'v3 claim zero retains three-day internal warnings to Calidad and owner')
 check((await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE status='leased'")).rows[0].n===leasedBeforeTwo,'Two-client-mail policy does not make claim zero reserve emails')
 const twoCitizenChecks=checks-baselineChecks
 console.log(JSON.stringify({ok:true,checks,baselineChecks,twoCitizenChecks,scope:'Internal notices and two citizen mails; isolated PostgreSQL; no remote writes or email'}))
 fs.writeFileSync(path.join(root,'.performance/quejas-internal-db-evidence.json'),JSON.stringify({ok:true,checks,baselineChecks,twoCitizenChecks,at:new Date().toISOString()},null,2))
} finally {if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-w','stop','-m','fast'])}
