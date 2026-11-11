// PostgreSQL desechable, identidades sintéticas y SQL real. Sin .env ni red remota.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { verifyUrgentMail } from './test-quejas-urgent-mail-db.mjs'

const root=process.cwd(), bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin'
const work=path.join(root,'.performance','quejas-quality-db-'+Date.now()), data=path.join(work,'data'),port=Number(process.env.QMS_PG_PORT??55459)
const {Pool}=createRequire(path.join(root,'.performance/load-tools/package.json'))('pg')
const password=randomBytes(32).toString('hex');let pool,started=false,checks=0
const schema=JSON.parse(fs.readFileSync('supabase/backups/quejas_workflow_schema_20261010.json','utf8'))
const section=n=>schema.find(x=>x.section===n).data
const q=value=>'"'+value.replaceAll('"','""')+'"'
function run(binary,args){const r=spawnSync(path.join(bin,binary),args,{encoding:'utf8',stdio:'ignore',windowsHide:true,timeout:60000});if(r.status!==0)throw new Error('PostgreSQL fixture command failed: '+binary+' '+(r.error?.code??r.status))}
function check(c,m){assert.ok(c,m);checks++}
async function rejects(fn,code,m){await assert.rejects(fn,e=>e.code===code,m);checks++}
async function as(actor,sql,args=[],role='authenticated'){const c=await pool.connect();try{await c.query('SET ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor?.auth??'']);return(await c.query(sql,args)).rows}finally{await c.query('RESET ROLE');c.release()}}
const actors=Object.fromEntries(['admin','quality','owner','other','inactive','denied'].map(k=>[k,{id:randomUUID(),auth:randomUUID()}]))
const service=async(sql,args=[])=>(await as(null,sql,args,'service_role'))
const newCase=async()=>(await as(actors.admin,'SELECT to_jsonb(public.crear_queja_interna($1,$2,$3,$4,NULL)) value',['Persona privada','private@example.test','Queja','DESCRIPCION PRIVADA']))[0].value
const transition=async(c,state,params={},actor=actors.admin)=>(await as(actor,'SELECT public.qms_transition_complaint($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value',[c.id,c.revision,state,params.resolution??null,params.justification??null,params.owner??null,params.reopen??null,params.office??null,params.resolution?'markdown':null,params.justification?'markdown':null]))[0].value
const access=async(id)=>(await service('SELECT qms_public_tracking_access($1) value',[id]))[0].value
const read=async(a)=>(await service('SELECT qms_public_tracking_read($1,$2) value',[a.queja_id,a.nonce]))[0].value
const publish=async(c,file,options={},actor=actors.admin)=>(await as(actor,'SELECT qms_resolve_complaint_with_document($1,$2,$3,$4,$5,$6) value',[c.id,options.state??'rejected',options.details??{office_number:'ECA-'+c.folio},options.revision??c.revision,file,options.response??'Respuesta oficial pública.']))[0].value
const attach=async(c,name='Oficio.pdf')=>(await pool.query("INSERT INTO queja_adjuntos(queja_id,nombre,nombre_archivo,storage_path,tipo_mime,tamano,usuario_id) VALUES($1,$2,$2,$3,'application/pdf',100,$4) RETURNING id",[c.id,name,'drive_file_'+randomUUID().replaceAll('-',''),actors.quality.id])).rows[0].id
try {
  fs.mkdirSync(work,{recursive:true});const pw=path.join(work,'pw');fs.writeFileSync(pw,password)
  run('initdb.exe',['-D',data,'-U','qms_fixture','-A','scram-sha-256','--pwfile='+pw,'--encoding=UTF8','--locale=C']);fs.unlinkSync(pw)
  run('pg_ctl.exe',['-D',data,'-l',path.join(work,'postgres.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true
  pool=new Pool({host:'127.0.0.1',port,user:'qms_fixture',password,database:'postgres',max:12,statement_timeout:15000})
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
  for(const [name,a]of Object.entries(actors))await pool.query('INSERT INTO usuarios VALUES($1,$2,$3,$4,$5)',[a.id,a.auth,name==='quality'?'calidad':['owner','other'].includes(name)?'colaborador':name==='denied'?'auditor':'admin',name==='inactive'?'inactivo':'activo',name+'@example.test'])
  await pool.query("INSERT INTO permisos VALUES('calidad','quejas',true,true),('colaborador','mis_quejas',true,true)")
  await pool.query("INSERT INTO qms_calendars(id,weekdays) VALUES(1,ARRAY[1,2,3,4,5]);SELECT setval(pg_get_serial_sequence('qms_calendars','id'),1);INSERT INTO qms_stages VALUES('quejas.evaluation','quejas','Evaluación','Recibido','Decisión'),('quejas.investigation','quejas','Investigación','En Investigación','Cierre');INSERT INTO qms_stage_versions(id,stage_id,duration,day_type,alerts,expiration_action) VALUES(1,'quejas.evaluation',3,'calendar_days',ARRAY[1],'notify_quality'),(2,'quejas.investigation',15,'business_days',ARRAY[3,1],'notify_quality');SELECT setval(pg_get_serial_sequence('qms_stage_versions','id'),2)")
  for(const [internal,code]of Object.entries({Recibido:'received','En Investigación':'investigation','Pendiente de Revisión GC':'quality_review',Resuelto:'resolved',Finalizado:'finished','No Procede':'rejected'}))await pool.query("INSERT INTO catalogos(modulo,tipo,valor,valor_interno,codigo,color) VALUES('quejas','estado_queja',$1,$1,$2,'primary')",[internal,code])
  await pool.query("CREATE TABLE formularios_publicos(id uuid PRIMARY KEY,token text,activo boolean,modulo text);CREATE TABLE public_form_submissions(form_id uuid,submission_id uuid,payload_hash text,queja_id uuid,created_at timestamptz DEFAULT now(),finalized_at timestamptz,PRIMARY KEY(form_id,submission_id));CREATE TABLE public_form_rate_limits(key_hash text,operation text,attempts integer,reset_at timestamptz,PRIMARY KEY(key_hash,operation));CREATE TABLE public_form_uploads(form_id uuid,submission_id uuid,status text)")
  const gateway=fs.readFileSync('supabase/migrations/20261008224037_public_forms_gateway.sql','utf8')
  await pool.query(gateway.slice(gateway.indexOf('CREATE FUNCTION public.public_form_consume_rate'),gateway.indexOf('CREATE FUNCTION public.public_form_create_submission')))
  for(const f of section('functions'))await pool.query(f.body)
  await pool.query('CREATE VIEW public.qms_quejas WITH(security_invoker=true) AS '+section('views').find(x=>x.name==='qms_quejas').definition)
  for(const t of section('triggers'))await pool.query(t.definition)
  for(const table of ['quejas','catalogos','qms_calendars','qms_stage_versions','qms_stage_runs'])await pool.query(`ALTER TABLE ${q(table)} ENABLE ROW LEVEL SECURITY`)
  for(const p of section('policies').filter(x=>['quejas','catalogos','qms_calendars','qms_stage_versions','qms_stage_runs'].includes(x.tablename))) await pool.query(`CREATE POLICY ${q(p.policyname)} ON ${q(p.tablename)} FOR ${p.cmd} TO ${p.roles.map(q).join(',')}${p.qual?' USING('+p.qual+')':''}${p.with_check?' WITH CHECK('+p.with_check+')':''}`)
  await pool.query('GRANT SELECT ON qms_quejas TO authenticated;CREATE UNIQUE INDEX qms_one_active_run ON qms_stage_runs(case_id) WHERE ended_at IS NULL;ALTER TABLE qms_deadline_notices ADD CONSTRAINT qms_deadline_notices_run_id_fkey FOREIGN KEY(run_id) REFERENCES qms_stage_runs(id)')
  const attachments=JSON.parse(fs.readFileSync('supabase/backups/drive_registry_preflight_20261008.json','utf8')).columns
  await pool.query('CREATE TABLE public.queja_adjuntos('+attachments.map(x=>`${q(x.column_name)} ${x.data_type}${x.column_default?' DEFAULT '+x.column_default:''}${x.is_nullable==='NO'?' NOT NULL':''}`).join(',')+',PRIMARY KEY(id),FOREIGN KEY(queja_id) REFERENCES quejas(id))')
  for(const migration of ['20261011044303_quejas_workflow_completion.sql','20261011044317_quejas_mail_outbox.sql','20261011044810_quejas_rpc_surface_hardening.sql','20261015011028_quejas_internal_notices.sql'])await pool.query(fs.readFileSync('supabase/migrations/'+migration,'utf8'))
  // Reconciliar contratos con el preflight real de esta entrega, no solo SQL histórico.
  for(const f of JSON.parse(fs.readFileSync('supabase/backups/public_tracking_preflight_20261015.json','utf8')).functions)await pool.query(f.definition)
  await pool.query('BEGIN');await pool.query(fs.readFileSync('supabase/migrations/20261015223440_quejas_public_tracking.sql','utf8'));await pool.query('COMMIT')
  for(const f of JSON.parse(fs.readFileSync('supabase/backups/quejas_quality_flow_preflight_20261104.json','utf8')).functions)await pool.query(f.definition)
  await pool.query(`CREATE TABLE quejas_actividad(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),queja_id uuid NOT NULL REFERENCES quejas(id),tipo text NOT NULL,descripcion text NOT NULL,usuario_id uuid REFERENCES usuarios(id),created_at timestamptz NOT NULL DEFAULT now());
    CREATE TRIGGER zz_qms_require_published_resolution BEFORE UPDATE ON quejas FOR EACH ROW EXECUTE FUNCTION qms_require_published_resolution();
    REVOKE ALL ON FUNCTION qms_transition(uuid,bigint,text,text,text,uuid,text),transicionar_queja(uuid,text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;`)
  await pool.query(fs.readFileSync('supabase/migrations/20261104202558_quejas_revision_y_respuesta_separadas.sql','utf8'))
  const review=async(c,decision='approved',reason=null,actor=actors.quality)=>(await as(actor,'SELECT qms_review_resolution($1,$2,$3,$4) value',[c.id,c.revision,decision,reason]))[0].value
  const save=async(c,version=0,response='',office='',file=null,actor=actors.quality)=>(await as(actor,'SELECT qms_save_response_draft($1,$2,$3,$4,$5,$6) value',[c.id,c.revision,version,response,office,file]))[0].value
  const finish=async(c,file,version=0,response='Respuesta autorizada al cliente',office='ECA-GC-'+c.folio,actor=actors.quality)=>(await as(actor,'SELECT qms_publish_approved_response($1,$2,$3,$4,$5,$6) value',[c.id,c.revision,version,response,office,file]))[0].value
  const count=async(table,id)=>(await pool.query('SELECT count(*)::integer n FROM '+table+' WHERE queja_id=$1',[id])).rows[0].n
  const current=async c=>(await pool.query('SELECT to_jsonb(q) value FROM qms_quejas q WHERE id=$1',[c.id])).rows[0].value
  const finals=async c=>(await pool.query("SELECT * FROM queja_mail_outbox WHERE queja_id=$1 AND tipo='final'",[c.id])).rows
  const pending=async()=>{let c=await newCase();c=await transition(c,'investigation',{owner:actors.owner.id,justification:'Procede investigar'});return transition(c,'quality_review',{resolution:'PROPUESTA INTERNA DEL RESPONSABLE'},actors.owner)}
  let c=await pending();const before={due:c.fecha_limite_investigacion,proposal:c.resolucion,run:(await pool.query("SELECT id FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL",[c.id])).rows[0].id}
  for(const actor of [actors.owner,actors.other,actors.inactive,actors.denied,null])await rejects(()=>review(c,'approved',null,actor),'42501','Review denies unauthorized actor')
  await rejects(()=>as(null,'SELECT qms_review_resolution($1,$2,$3,NULL)',[c.id,c.revision,'approved'],'anon'),'42501','Anonymous cannot execute review')
  await rejects(()=>review(c,'returned','  '),'22023','Return requires reason')
  await rejects(()=>review(c,'approved','Unrequested comment'),'22023','Approval does not accept observations')
  await rejects(()=>review({...c,revision:c.revision+1}),'40001','Expected case revision enforced')
  check(await count('queja_gc_revisiones',c.id)===0,'Invalid reviews leave no history')
  const returned=await review(c,'returned','Comprobar el hallazgo antes de aprobar.')
  check(returned.estado==='En Investigación','Return restores investigation')
  check(returned.resolucion===before.proposal,'Return retains original proposal')
  check(returned.fecha_limite_investigacion===before.due,'Return preserves original deadline')
  const activeRun=(await pool.query("SELECT * FROM qms_stage_runs WHERE case_id=$1 AND ended_at IS NULL",[c.id])).rows[0]
  check(activeRun.id===before.run,'Return retains stage snapshot')
  const history=(await pool.query('SELECT * FROM queja_gc_revisiones WHERE queja_id=$1',[c.id])).rows[0]
  check(history.usuario_id===actors.quality.id&&history.created_at&&history.motivo==='Comprobar el hallazgo antes de aprobar.'&&history.propuesta===before.proposal,'Return audit stores author, date, reason and immutable proposal')
  check((await pool.query('SELECT count(*)::integer n FROM notificaciones WHERE origen_id=$1 AND usuario_id=$2',[c.id,actors.owner.id])).rows[0].n>0,'Existing responsible notification used')
  check((await finals(c)).length===0&&await count('queja_public_resolutions',c.id)===0,'Return sends no citizen final communication')
  c=await transition(returned,'quality_review',{resolution:'PROPUESTA CORREGIDA'},actors.owner)
  const approvalResponses=await Promise.allSettled([review(c),review(c)])
  check(approvalResponses.filter(r=>r.status==='fulfilled').length===1,'Double approval writes once')
  check(approvalResponses.find(r=>r.status==='rejected').reason.code==='40001','Duplicate approval conflicts')
  const approved=approvalResponses.find(r=>r.status==='fulfilled').value
  check(approved.estado==='Resuelto'&&approved.numero_oficio_resolucion===null,'Approve without office enters Resuelto')
  check(approved.fecha_cierre===null,'Approval does not close complaint')
  check((await finals(c)).length===0&&await count('queja_public_resolutions',c.id)===0,'Approval neither publishes nor queues mail')
  check(approved.resolucion==='PROPUESTA CORREGIDA'&&await count('queja_gc_revisiones',c.id)===2,'Current proposal and previous review both retained')
  await rejects(()=>transition(approved,'finished',{office:'BYPASS'}),'55000','Cannot finish approved case before publication')
  const file=await attach(c),otherCase=await pending(),foreignFile=await attach(otherCase)
  const race=await Promise.allSettled([save(approved,0,'Borrador uno','',file),save(approved,0,'Borrador dos','',file)])
  check(race.filter(r=>r.status==='fulfilled').length===1,'Concurrent drafts serialized')
  check(race.find(r=>r.status==='rejected').reason.code==='40001','Stale draft cannot overwrite latest')
  const draft=race.find(r=>r.status==='fulfilled').value
  check(draft.version===1&&draft.actualizado_por===actors.quality.id&&draft.updated_at,'Draft author/date/version captured')
  const recovered=(await as(actors.quality,'SELECT * FROM queja_response_drafts WHERE queja_id=$1',[c.id]))[0]
  check(recovered.respuesta===draft.respuesta&&recovered.adjunto_id===file,'Draft recovers response and file reference')
  const saved=await save(approved,1,'Respuesta lista para confirmar','OFICIO-001',file)
  check(saved.version===2&&(await current(c)).estado==='Resuelto'&&(await current(c)).revision===approved.revision,'Saving does not change workflow or case revision')
  check((await finals(c)).length===0&&await count('queja_public_resolutions',c.id)===0,'Draft remains private with no customer mail')
  check((await as(actors.owner,'SELECT * FROM queja_response_drafts')).length===0,'Assigned collaborator cannot read customer draft')
  check((await as(actors.owner,'SELECT * FROM queja_gc_revisiones')).length===0,'Collaborator cannot read protected GC review snapshots')
  for(const table of ['queja_response_drafts','queja_gc_revisiones'])for(const role of ['anon','authenticated'])for(const permission of ['INSERT','UPDATE','DELETE','TRUNCATE'])check(!(await pool.query('SELECT has_table_privilege($1,$2,$3) value',[role,table,permission])).rows[0].value,'Direct writes closed '+table+' '+role+' '+permission)
  await pool.query("UPDATE permisos SET escribir=false WHERE rol='calidad'")
  await rejects(()=>save(approved,2,'No autorizado'),'42501','Read-only Calidad cannot save')
  await rejects(()=>finish(approved,file,2),'42501','Read-only Calidad cannot publish')
  check((await as(actors.quality,'SELECT * FROM queja_response_drafts WHERE queja_id=$1',[c.id])).length===1,'Read-only Calidad can consult saved draft')
  await pool.query("UPDATE permisos SET escribir=true WHERE rol='calidad'")
  await rejects(()=>finish(approved,foreignFile,2),'22023','Foreign document rejected')
  await rejects(()=>finish(approved,file,2,''),'22023','Response required at publication')
  await rejects(()=>finish(approved,file,2,'Respuesta',''),'22023','Office required at publication')
  await rejects(()=>save(approved,2,'x'.repeat(10001)),'22023','Ten-thousand character limit enforced by DB')
  await pool.query('INSERT INTO queja_attachment_deletions VALUES($1,$2,now())',[file,actors.quality.id])
  await rejects(()=>finish(approved,file,2),'55000','Reserved deletion cannot become official document')
  await pool.query('DELETE FROM queja_attachment_deletions WHERE adjunto_id=$1',[file])
  const capability=await access(c.id),final=await finish(approved,file,2)
  check(final.estado==='Finalizado'&&final.fecha_cierre,'Publication finalizes complaint')
  const publication=(await pool.query('SELECT * FROM queja_public_resolutions WHERE queja_id=$1',[c.id])).rows[0]
  check(publication.respuesta==='Respuesta autorizada al cliente'&&publication.adjunto_id===file&&publication.publicado_por===actors.quality.id&&publication.publicado_at,'Exact authorized response and official file published')
  const visible=await read(capability)
  check(visible.respuesta===publication.respuesta&&visible.documento.id===file&&!JSON.stringify(visible).includes('PROPUESTA'),'Public tracking exposes neither internal proposal nor other files')
  const outbox=await finals(c)
  check(outbox.length===1&&outbox[0].estado==='Resuelto','One final event uses existing mail transport contract')
  await rejects(()=>finish(approved,file,2),'40001','Repeated publication cannot write again')
  await rejects(()=>pool.query("UPDATE queja_public_resolutions SET respuesta='alterada' WHERE queja_id=$1",[c.id]),'55000','Published response immutable for separated flow')
  check((await finals(c)).length===1,'Repeated requests do not duplicate mail')
  const rejected=await newCase(),rejectedFile=await attach(rejected)
  const rejectedFinal=await publish(rejected,rejectedFile)
  check(rejectedFinal.estado==='No Procede'&&(await finals(rejected)).length===1,'No Procede unchanged')
  let legacy=await pending();const legacyFile=await attach(legacy)
  legacy=await publish(legacy,legacyFile,{state:'resolved'})
  check(legacy.estado==='Resuelto'&&(await finals(legacy)).length===1,'Legacy combined publication remains compatible')
  await rejects(()=>finish(legacy,legacyFile),'55000','Existing publication cannot be overwritten by new flow')
  const legacyClosed=await transition(legacy,'finished')
  check(legacyClosed.estado==='Finalizado'&&(await finals(legacy)).length===1,'Legacy Resuelto can close without new publication or mail')
  let reopened=await transition(legacyClosed,'investigation',{reopen:'Comprobar nuevo hallazgo'});
  reopened=await transition(reopened,'quality_review',{resolution:'NUEVA PROPUESTA INTERNA'},actors.owner);
  reopened=await review(reopened);
  check(reopened.estado==='Resuelto','Reopened case can receive an internal approval');
  await rejects(()=>save(reopened,0,'Reemplazo'),'55000','Historical response remains read-only after reopening');
  await rejects(()=>finish(reopened,legacyFile),'55000','Reopened case cannot overwrite historical publication');
  const reclosed=await transition(reopened,'finished');
  check(reclosed.estado==='Finalizado'&&(await finals(reclosed)).length===1,'Historical reply can be retained without duplicate communication');
  const oldSnapshot=(await pool.query("SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) value FROM queja_mail_outbox o")).rows[0].value
  await pool.query(fs.readFileSync('supabase/migrations/20261110150300_quejas_correo_editable.sql','utf8'))
  const afterSnapshot=(await pool.query("SELECT jsonb_agg(to_jsonb(o)-'correo_asunto'-'correo_cuerpo' ORDER BY o.id) value FROM queja_mail_outbox o")).rows[0].value
  check(JSON.stringify(oldSnapshot)===JSON.stringify(afterSnapshot),'Additive email migration preserves every historical outbox field')
  const saveEmail=async(q,version,subject,body,actor=actors.quality)=>(await as(actor,'SELECT qms_save_response_draft_v2($1,$2,$3,$4,$5,$6,$7,$8) value',[q.id,q.revision,version,'Respuesta pública separada','ECA-CORREO',null,subject,body]))[0].value
  const finishEmail=async(q,file,version,subject,body,actor=actors.quality)=>(await as(actor,'SELECT qms_publish_approved_response_v2($1,$2,$3,$4,$5,$6,$7,$8) value',[q.id,q.revision,version,'Respuesta pública separada','ECA-CORREO',file,subject,body]))[0].value
  const mailCase=await review(await pending()),mailFile=await attach(mailCase)
  const mailBody='Estimada Persona de prueba:\n\nLos resultados se encuentran en el informe adjunto.\n\nAtentamente, Gestión de Calidad.'
  for(const actor of [actors.owner,actors.inactive,actors.denied])await rejects(()=>saveEmail(mailCase,0,'Asunto',mailBody,actor),'42501','Email draft enforces existing active staff/module authorization')
  for(const role of ['anon','service_role'])for(const fn of ['qms_save_response_draft_v2','qms_publish_approved_response_v2'])check(!(await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') value",[role,fn+'(uuid,bigint,bigint,text,text,uuid,text,text)'])).rows[0].value,'Email RPC closed to '+role)
  check(!(await pool.query("SELECT has_function_privilege('authenticated','qms_mail_claim_batch_v4(integer,integer,uuid,bigint)','EXECUTE') value")).rows[0].value,'Browser cannot claim mail contents')
  check(!(await pool.query("SELECT has_function_privilege('authenticated','qms_private.email_delivery_ready()','EXECUTE') value")).rows[0].value,'Browser cannot enable the sender')
  const emailDraft=await saveEmail(mailCase,0,'Asunto personal',mailBody)
  check(emailDraft.version===1&&emailDraft.correo_cuerpo===mailBody&&emailDraft.respuesta==='Respuesta pública separada','Email saved independently of public response and internal resolution')
  await rejects(()=>saveEmail(mailCase,0,'Asunto distinto','Cambios de otra visita'),'40001','Email draft CAS cannot overwrite another version')
  await rejects(()=>saveEmail(mailCase,1,'Cabecera\nInyectada',mailBody),'22023','Header injection rejected')
  await rejects(()=>saveEmail(mailCase,1,'Asunto','x'.repeat(3501)),'22023','Email body bound enforced in DB')
  await rejects(()=>saveEmail(mailCase,1,'😀'.repeat(91),mailBody),'22023','Subject bound counts UTF-16 units')
  const unicodeDraft=await saveEmail(mailCase,1,'😀'.repeat(90),'😀'.repeat(1750))
  check(unicodeDraft.version===2,'Valid astral characters remain supported at the transport boundary')
  await rejects(()=>saveEmail(mailCase,2,'Asunto','😀'.repeat(1751)),'22023','Astral body cannot exceed signed transport limit')
  const currentDraft=await saveEmail(mailCase,2,'Asunto personal',mailBody)
  await rejects(()=>finishEmail(mailCase,mailFile,3,'Asunto personal',mailBody),'55000','Publication gated until upgraded sender is ready')
  check((await current(mailCase)).estado==='Resuelto'&&(await finals(mailCase)).length===0,'Readiness failure is atomic')
  await pool.query(fs.readFileSync('supabase/migrations/20261110151342_quejas_habilitar_correo_editable.sql','utf8'))
  await rejects(()=>finishEmail(mailCase,mailFile,3,'',''),'22023','Incomplete email cannot be published')
  const emailFinal=await finishEmail(mailCase,mailFile,currentDraft.version,'Asunto personal',mailBody)
  const emailOutbox=(await finals(mailCase))[0]
  check(emailFinal.estado==='Finalizado'&&emailOutbox.correo_asunto==='Asunto personal'&&emailOutbox.correo_cuerpo===mailBody,'Publication atomically enqueues the exact edited subject and body')
  check((await pool.query('SELECT respuesta FROM queja_public_resolutions WHERE queja_id=$1',[mailCase.id])).rows[0].respuesta==='Respuesta pública separada','Cover email never replaces the public response or report')
  await rejects(()=>finishEmail(mailCase,mailFile,3,'Reenvío','Otro correo'),'40001','Repeated publication does not resend or alter email snapshot')
  check((await finals(mailCase)).length===1&&(await finals(mailCase))[0].correo_cuerpo===mailBody,'Final email remains singular and unchanged after retry')
  await pool.query("UPDATE queja_mail_outbox SET next_attempt_at=now()+interval '1 day' WHERE queja_id<>$1",[mailCase.id])
  const receivedBatch=await service('SELECT * FROM qms_mail_claim_batch_v4($1,120,$2,$3)',[5,randomUUID(),Math.floor(Date.now()/1000)])
  const receivedMail=receivedBatch.find(row=>row.tipo==='recibido')
  check(!!receivedMail&&!receivedBatch.some(row=>row.tipo==='final'),'Final delivery still waits for the receipt email')
  await service('SELECT qms_mail_complete($1,$2,$3,$4,$5)',[receivedMail.id,receivedMail.claim_token,'sent',60,null])
  const mailBatch=await service('SELECT * FROM qms_mail_claim_batch_v4($1,120,$2,$3)',[5,randomUUID(),Math.floor(Date.now()/1000)])
  check(mailBatch.some(row=>row.id===emailOutbox.id&&row.correo.subject==='Asunto personal'&&row.correo.body===mailBody),'Machine-only claim projects the frozen email without client-supplied recipients')
  const frozenMail=mailBatch.find(row=>row.id===emailOutbox.id)
  check((await service('SELECT qms_mail_authorize_v2($1,$2) value',[frozenMail.id,frozenMail.claim_token]))[0].value===true,'Published custom email is eligible for physical delivery')
  check((await service('SELECT qms_mail_authorize_v2($1,$2) value',[frozenMail.id,randomUUID()]))[0].value===false,'Wrong lease token never authorizes a citizen email')
  await pool.query('INSERT INTO queja_attachment_deletions VALUES($1,$2,now())',[mailFile,actors.quality.id])
  check((await service('SELECT qms_mail_authorize_v2($1,$2) value',[frozenMail.id,frozenMail.claim_token]))[0].value===false,'Deletion reservation blocks final document delivery')
  await pool.query('DELETE FROM queja_attachment_deletions WHERE adjunto_id=$1',[mailFile])
  await service('SELECT qms_mail_complete($1,$2,$3,$4,$5)',[frozenMail.id,frozenMail.claim_token,'sent',60,null])
  check((await finals(mailCase))[0].status==='sent','Custom final email retains the existing delivery acknowledgement contract')
  await pool.query(fs.readFileSync('supabase/migrations/20261110165806_quejas_no_procede_correo.sql','utf8'))
  const rejectSave=async(q,version,reason='',format='plain',actor=actors.quality)=>(await as(actor,'SELECT qms_save_rejected_response_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value',[q.id,q.revision,version,'Fundamentos en el informe adjunto',q.folio,null,'Respuesta - Folio '+q.folio,'Estimada Persona: consulte el informe adjunto. Para consultas: gc@eca.or.cr.',reason,format]))[0].value
  const rejectPublish=async(q,file,version,reason='La solicitud corresponde a otra entidad.',actor=actors.quality)=>(await as(actor,'SELECT qms_publish_rejected_response($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value',[q.id,q.revision,version,'Fundamentos en el informe adjunto',q.folio,file,'Respuesta - Folio '+q.folio,'Estimada Persona: consulte el informe adjunto. Para consultas: gc@eca.or.cr.',reason,'markdown']))[0].value
  const rejection=await newCase(),rejectionFile=await attach(rejection)
  for(const actor of [actors.owner,actors.inactive,actors.denied])await rejects(()=>rejectSave(rejection,0,'Motivo','plain',actor),'42501','Rejection draft preserves staff authorization')
  for(const role of ['anon','service_role'])for(const fn of ['qms_save_rejected_response_draft','qms_publish_rejected_response'])check(!(await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') value",[role,fn+'(uuid,bigint,bigint,text,text,uuid,text,text,text,text)'])).rows[0].value,'Rejection email RPC closed to '+role)
  const rejectionDraft=await rejectSave(rejection,0)
  check(rejectionDraft.version===1&&rejectionDraft.motivo_no_procede===''&&(await current(rejection)).estado==='Recibido','Incomplete rejection draft never closes or notifies')
  check((await finals(rejection)).length===0,'Saving rejection sends no email')
  await rejects(()=>rejectSave(rejection,0,'Otra visita'),'40001','Rejection draft CAS cannot overwrite another version')
  await rejects(()=>rejectSave({...rejection,revision:rejection.revision+1},1,'Motivo'),'40001','Rejection preserves the original case revision')
  await rejects(()=>rejectSave(rejection,1,'x'.repeat(10001)),'22023','Rejection reason bound enforced in DB')
  await rejects(()=>rejectSave(rejection,1,'Motivo','html'),'22023','Rejection reason format is explicit and closed')
  await rejects(()=>rejectPublish(rejection,rejectionFile,1,''),'22023','Rejection cannot publish without justification')
  await rejects(()=>rejectPublish(rejection,foreignFile,1),'22023','Rejection never publishes a foreign document')
  await rejects(()=>rejectPublish(rejection,rejectionFile,0),'40001','Stale rejection draft cannot publish')
  check((await current(rejection)).estado==='Recibido'&&(await finals(rejection)).length===0&&await count('queja_public_resolutions',rejection.id)===0,'Failed rejection publication rolls back workflow, publication and email')
  const rejectedWithMail=await rejectPublish(rejection,rejectionFile,1,'**La solicitud corresponde a otra entidad.**')
  check(rejectedWithMail.estado==='No Procede'&&rejectedWithMail.fecha_cierre&&rejectedWithMail.resolucion==='**La solicitud corresponde a otra entidad.**'&&rejectedWithMail.resolucion_formato==='markdown','Rejection atomically stores justification, format and close date')
  const rejectionEvent=(await finals(rejection))[0]
  check(rejectionEvent.correo_cuerpo.includes('gc@eca.or.cr')&&rejectionEvent.correo_asunto==='Respuesta - Folio '+rejection.folio,'Rejection enqueues the exact editable cover email')
  check((await pool.query('SELECT adjunto_id,respuesta FROM queja_public_resolutions WHERE queja_id=$1',[rejection.id])).rows[0].adjunto_id===rejectionFile,'Rejection publishes only the selected official report')
  await rejects(()=>rejectPublish(rejection,rejectionFile,1),'40001','Repeated rejection never sends another mail')
  check((await finals(rejection)).length===1,'One final email after repeated rejection request')
  const abandoned=await newCase();await rejectSave(abandoned,0,'Motivo descartado','markdown')
  let continued=await transition(abandoned,'investigation',{owner:actors.owner.id,justification:'Procede investigar'})
  continued=await transition(continued,'quality_review',{resolution:'Propuesta aprobable'},actors.owner);continued=await review(continued)
  const clean=await saveEmail(continued,1,'Respuesta aprobada','Correo de acompañamiento de la resolución aprobada.')
  check(clean.motivo_no_procede===null&&clean.motivo_no_procede_formato===null,'Approved draft clears an abandoned rejection without resetting its version')
  await verifyUrgentMail({ pool,service,newCase,check,rejects })
  const result={ok:true,checks,scope:'Isolated PostgreSQL: quality flow, independent editable email, urgent citizen queue and transactional wake with mocked net/Vault',remoteWrites:false}
  console.log(JSON.stringify(result));fs.writeFileSync(path.join(root,'.performance/quejas-quality-flow-db-evidence.json'),JSON.stringify(result,null,2))
} finally {if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-w','stop','-m','fast'])}
