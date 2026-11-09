// PostgreSQL desechable, identidades sintéticas y SQL real. Sin .env ni red remota.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const root=process.cwd(), bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin'
const work=path.join(root,'.performance','quejas-tracking-db-'+Date.now()), data=path.join(work,'data'),port=55458
const {Pool}=createRequire(path.join(root,'.performance/load-tools/package.json'))('pg')
const password=randomBytes(32).toString('hex');let pool,started=false,checks=0
const schema=JSON.parse(fs.readFileSync('supabase/backups/quejas_workflow_schema_20261010.json','utf8'))
const section=n=>schema.find(x=>x.section===n).data
const q=value=>'"'+value.replaceAll('"','""')+'"'
function run(binary,args){const r=spawnSync(path.join(bin,binary),args,{encoding:'utf8',stdio:'ignore',windowsHide:true,timeout:60000});if(r.status!==0)throw new Error('PostgreSQL fixture command failed: '+binary)}
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
const accessRow=async id=>(await pool.query('SELECT * FROM queja_public_access WHERE queja_id=$1',[id])).rows[0]
// Solo esta fixture desechable permite simular fechas históricas sin modificar el
// reloj del sistema ni relajar el invariante productivo de recepción automática.
async function historicalCase(c,receivedDays,closedDays) {
  const client=await pool.connect()
  try {
    await client.query('BEGIN');await client.query('ALTER TABLE quejas DISABLE TRIGGER a_qms_complaint_metadata')
    await client.query("UPDATE quejas SET fecha=now()-$2*interval '24 hours',fecha_cierre=CASE WHEN $3::integer IS NULL THEN NULL ELSE now()-$3*interval '24 hours' END WHERE id=$1",[c.id,receivedDays,closedDays])
    await client.query('ALTER TABLE quejas ENABLE TRIGGER a_qms_complaint_metadata');await client.query('COMMIT')
    return (await client.query('SELECT to_jsonb(q) value FROM quejas q WHERE id=$1',[c.id])).rows[0].value
  } catch(error) {await client.query('ROLLBACK');throw error} finally {client.release()}
}
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
  const legacy=await newCase()
  const legacyPayload=(await pool.query('SELECT to_jsonb(o) data FROM queja_mail_outbox o WHERE queja_id=$1',[legacy.id])).rows[0].data
  await pool.query('BEGIN');await pool.query(fs.readFileSync('supabase/migrations/20261015223440_quejas_public_tracking.sql','utf8'));await pool.query('COMMIT')
  check((await pool.query('SELECT public_tracking FROM queja_mail_outbox WHERE queja_id=$1',[legacy.id])).rows[0].public_tracking===null,'Historical mail remains unchanged')
  check((await pool.query('SELECT to_jsonb(o)-\'public_tracking\' data FROM queja_mail_outbox o WHERE queja_id=$1',[legacy.id])).rows[0].data.id===legacyPayload.id,'No mail recreation')
  for(const role of ['anon','authenticated']) {
    for(const table of ['queja_public_access','queja_attachment_deletions'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])check(!(await pool.query('SELECT has_table_privilege($1,$2,$3) value',[role,table,privilege])).rows[0].value,role+' denied '+table+' '+privilege)
    for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])check(!(await pool.query('SELECT has_table_privilege($1,$2,$3) value',[role,'queja_public_resolutions',privilege])).rows[0].value,'Publication '+privilege+' denied')
    for(const signature of ['qms_public_tracking_access(uuid)','qms_ensure_public_tracking_access(uuid)','qms_public_tracking_read(uuid,uuid)','qms_public_tracking_document(uuid,uuid,uuid)','qms_claim_attachment_delete(uuid,uuid)','qms_mail_claim_batch_v3(integer,integer,uuid,bigint)'])check(!(await pool.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') value',[role,signature])).rows[0].value,'RPC denied to '+role)
  }
  for(const role of ['anon','authenticated','service_role'])for(const signature of ['qms_close_public_tracking_access()','qms_snapshot_public_tracking_mail()'])check(!(await pool.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') value',[role,signature])).rows[0].value,'Private trigger denied to '+role)
  check(!(await pool.query("SELECT has_function_privilege('anon','qms_resolve_complaint_with_document(uuid,text,jsonb,bigint,uuid,text)','EXECUTE') value")).rows[0].value,'Anonymous cannot publish')
  await rejects(()=>as(actors.admin,'SELECT public_tracking FROM queja_mail_outbox'),'42501','Mail capability never readable by authenticated client')
  let c=await newCase(),a=await access(c.id)
  const again=await access(c.id)
  check(JSON.stringify(a)===JSON.stringify(again),'Access retry preserves same private link')
  check(Object.keys(a).sort().join(',')==='nonce,queja_id','Capability has no changing expiry claim')
  check((await accessRow(c.id)).closed_at===null&&(await accessRow(c.id)).expires_at===null,'Open complaint has no premature deadline')
  const veryOld=await newCase();await historicalCase(veryOld,400,null)
  const veryOldAccess=await access(veryOld.id)
  check((await read(veryOldAccess)).folio===veryOld.folio&&(await accessRow(veryOld.id)).expires_at===null,'Open case older than a year stays accessible')
  await rejects(()=>pool.query('UPDATE queja_public_access SET expires_at=now() WHERE queja_id=$1',[veryOld.id]),'23514','Cannot set expiry without closure')
  await rejects(()=>pool.query("UPDATE queja_public_access SET closed_at=now(),expires_at=now()+interval '31 days' WHERE queja_id=$1",[veryOld.id]),'23514','Cannot persist a window other than thirty days')
  const dst=await pool.connect()
  try {
    await dst.query('BEGIN');await dst.query("SET LOCAL TIME ZONE 'America/New_York'")
    await dst.query("UPDATE queja_public_access SET closed_at='2026-10-15 12:00:00 America/New_York',expires_at='2026-10-15 12:00:00 America/New_York'::timestamptz+interval '720 hours' WHERE queja_id=$1",[veryOld.id])
    check(Number((await dst.query('SELECT extract(epoch FROM expires_at-closed_at) seconds FROM queja_public_access WHERE queja_id=$1',[veryOld.id])).rows[0].seconds)===30*86400,'Thirty-day cutoff stays exactly 720 hours across DST')
  } finally {await dst.query('ROLLBACK');dst.release()}
  const first=await read(a)
  check(Object.keys(first).sort().join(',')==='actualizado_at,documento,estado,etapas,folio,numero_oficio,recibido_at,respuesta','Explicit public projection')
  check(first.etapas.length===1&&first.etapas[0].nombre==='Recepción'&&first.respuesta===null&&first.documento===null,'Receipt projects no final data')
  check(!JSON.stringify(first).includes('PRIVADA')&&!JSON.stringify(first).includes('private@')&&!JSON.stringify(first).includes('Persona privada'),'No citizen PII or original description')
  await rejects(()=>read({...a,nonce:randomUUID()}),'42501','Wrong capability denied')
  await rejects(()=>read({...a,queja_id:randomUUID()}),'42501','Another case denied')
  await rejects(()=>as(actors.admin,'SELECT qms_public_tracking_read($1,$2)',[a.queja_id,a.nonce]),'42501','Authenticated cannot bypass public gateway')
  const form=randomUUID(),sid=randomUUID()
  await pool.query('INSERT INTO public_form_submissions(form_id,submission_id,queja_id) VALUES($1,$2,$3)',[form,sid,c.id])
  await rejects(()=>access(c.id),'42501','Pending upload cannot obtain capability')
  await rejects(()=>read(a),'42501','Existing capability cannot bypass pending submission')
  await pool.query('UPDATE public_form_submissions SET finalized_at=now() WHERE queja_id=$1',[c.id])
  check((await read(a)).folio===c.folio,'Finalized submission visible')
  const foreign=await newCase(),foreignFile=await attach(foreign),file=await attach(c)
  for(const actor of [actors.owner,actors.other,actors.inactive,actors.denied,null])await rejects(()=>publish(c,file,{},actor),'42501','Only active authorized Calidad/admin publishes')
  await rejects(()=>publish(c,foreignFile),'22023','Cannot publish foreign file')
  const citizenFile=await attach(c),legacyFile=await attach(c)
  await pool.query('UPDATE queja_adjuntos SET usuario_id=NULL WHERE id=$1',[citizenFile])
  await pool.query("UPDATE queja_adjuntos SET storage_path='quejas/legacy/file.pdf' WHERE id=$1",[legacyFile])
  await rejects(()=>publish(c,citizenFile),'22023','Citizen evidence cannot be mistaken for institutional office')
  await rejects(()=>publish(c,legacyFile),'22023','Public office must use registered private Drive document')
  await rejects(()=>publish(c,file,{revision:c.revision+1}),'40001','Original CAS required')
  check((await accessRow(c.id)).closed_at===null,'Failed CAS cannot start the public-access countdown')
  await rejects(()=>publish(c,file,{response:'x'.repeat(10001)}),'22023','Public reply limit')
  await rejects(()=>publish(c,file,{state:'finished'}),'22023','Wrapper only response decisions')
  await rejects(()=>publish(c,file,{details:{office_number:'ECA-TEST',unexpected:'bad'}}),'22023','Reject unexpected details')
  await rejects(()=>publish(c,file,{details:{office_number:42}}),'22023','Reject coercion of details')
  const malformedCase=await newCase(),malformedFile=await attach(malformedCase)
  for(const [sql,value,label] of [
    ['tamano',null,'nullable size'],['tamano',0,'empty file'],['tamano',4194305,'file above four MiB'],
    ['nombre','','empty name'],['nombre','x'.repeat(256),'oversized name'],['nombre','folder/Oficio.pdf','path in name'],
    ['nombre','Oficio\n.pdf','control character in name'],['tipo_mime','','empty MIME'],
    ['tipo_mime','text/html; charset=UTF-8','invalid MIME'],['storage_path','short','invalid Drive ID'],
  ]) {
    await pool.query("UPDATE queja_adjuntos SET tamano=100,nombre='Oficio.pdf',tipo_mime='application/pdf',storage_path=$2 WHERE id=$1",[malformedFile,'drive_file_'+randomUUID().replaceAll('-','')])
    await pool.query(`UPDATE queja_adjuntos SET ${sql}=$2 WHERE id=$1`,[malformedFile,value])
    await rejects(()=>publish(malformedCase,malformedFile),'22023','Publication rejects '+label)
  }
  check((await pool.query('SELECT count(*)::int n FROM queja_public_resolutions WHERE queja_id=$1',[malformedCase.id])).rows[0].n===0,'Metadata rejection has no publication side effect')
  await pool.query("UPDATE queja_adjuntos SET tamano=4194304,nombre='Oficio.pdf',tipo_mime='application/pdf',storage_path=$2 WHERE id=$1",[malformedFile,'drive_file_'+randomUUID().replaceAll('-','')])
  const maximumCase=await publish(malformedCase,malformedFile)
  check(maximumCase.estado==='No Procede','Exactly four MiB is accepted')
  await rejects(()=>publish(c,file,{state:'resolved'}),'P0001','Illegal underlying transition rejected')
  check((await pool.query('SELECT count(*)::int n FROM queja_public_resolutions WHERE queja_id=$1',[c.id])).rows[0].n===0,'Illegal transition rolls publication back')
  check((await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE queja_id=$1 AND tipo='final'",[c.id])).rows[0].n===0,'Illegal transition does not enqueue final')
  c=await publish(c,file,{},actors.quality)
  const rejectedAccess=await accessRow(c.id)
  check(rejectedAccess.closed_at!==null&&rejectedAccess.expires_at-rejectedAccess.closed_at===30*86400000,'No Procede starts thirty natural days')
  check(Number.isInteger(rejectedAccess.closed_at.getTime()/1000),'Closure timestamp is persisted at second precision')
  check(rejectedAccess.closed_at.getTime()<=Date.now()&&Date.now()-rejectedAccess.closed_at.getTime()<10000,'Live closure anchors real database event time')
  check(JSON.stringify(await access(c.id))===JSON.stringify(a),'Closing preserves the same private link')
  const published=await read(a)
  check(published.estado==='No Procede'&&published.respuesta==='Respuesta oficial pública.'&&published.documento.id===file,'Approved public response and document')
  check(published.numero_oficio==='ECA-'+c.folio&&published.etapas.some(e=>e.nombre==='Respuesta'),'Official number and response milestone')
  check((await as(actors.quality,'SELECT queja_id FROM queja_public_resolutions WHERE queja_id=$1',[c.id])).length===1,'Calidad can read publication')
  check((await as(actors.other,'SELECT queja_id FROM queja_public_resolutions')).length===0,'Foreign owner cannot read publication')
  await rejects(()=>as(actors.admin,'UPDATE queja_public_resolutions SET respuesta=$1 WHERE queja_id=$2',['Malicious',c.id]),'42501','No direct publication writes')
  const doc=(await service('SELECT qms_public_tracking_document($1,$2,$3) value',[c.id,a.nonce,file]))[0].value
  check(Object.keys(doc).sort().join(',')==='folio,nombre,storage_path,tamano,tipo_mime','Document proxy projection only')
  await rejects(()=>service('SELECT qms_public_tracking_document($1,$2,$3)',[c.id,a.nonce,foreignFile]),'42501','Foreign document never downloadable')
  await rejects(()=>service('SELECT qms_claim_attachment_delete($1,$2)',[file,actors.admin.id]),'55000','Published Drive deletion blocked before network')
  await rejects(()=>pool.query('DELETE FROM queja_adjuntos WHERE id=$1',[file]),'23001','FK RESTRICT guards direct published metadata deletion')
  const deletion=(await service('SELECT qms_claim_attachment_delete($1,$2) value',[foreignFile,actors.admin.id]))[0].value
  const reserved=(await pool.query('SELECT claimed_at FROM queja_attachment_deletions WHERE adjunto_id=$1',[foreignFile])).rows[0].claimed_at.toISOString()
  check(deletion.id===foreignFile,'Deletion reservation returns own file')
  await service('SELECT qms_claim_attachment_delete($1,$2)',[foreignFile,actors.admin.id])
  check((await pool.query('SELECT claimed_at FROM queja_attachment_deletions WHERE adjunto_id=$1',[foreignFile])).rows[0].claimed_at.toISOString()===reserved,'Delete retry preserves claim')
  await rejects(()=>publish(foreign,foreignFile),'55000','Cannot publish file whose deletion started')
  await rejects(()=>service('SELECT qms_claim_attachment_delete($1,$2)',[foreignFile,actors.other.id]),'42501','Other owner cannot reserve deletion')
  const racing=await newCase(),raceFiles=await Promise.all([attach(racing),attach(racing)])
  const race=await Promise.allSettled(raceFiles.map(f=>publish(racing,f)))
  check(race.filter(x=>x.status==='fulfilled').length===1&&race.some(x=>x.reason?.code==='40001'),'Concurrent publications honor original revision')
  check((await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE queja_id=$1 AND tipo='final'",[racing.id])).rows[0].n===1,'Concurrent publications enqueue once')
  const deleting=await newCase(),deleteFile=await attach(deleting)
  const deleteRace=await Promise.allSettled([publish(deleting,deleteFile),service('SELECT qms_claim_attachment_delete($1,$2)',[deleteFile,actors.admin.id])])
  check(deleteRace.filter(x=>x.status==='fulfilled').length===1&&deleteRace.some(x=>x.reason?.code==='55000'),'Publish/delete race grants only one operation')
  const canPublish=(await pool.query('SELECT count(*)::int n FROM queja_public_resolutions WHERE queja_id=$1',[deleting.id])).rows[0].n
  const deleteClaim=(await pool.query('SELECT count(*)::int n FROM queja_attachment_deletions WHERE adjunto_id=$1',[deleteFile])).rows[0].n
  check(canPublish+deleteClaim===1,'Never publish a file whose deletion was claimed')
  await pool.query('UPDATE queja_public_access SET revoked_at=now() WHERE queja_id=$1',[c.id])
  await rejects(()=>read(a),'42501','Revocation blocks read')
  await rejects(()=>access(c.id),'42501','Access retry does not reverse revocation')
  await rejects(()=>service('SELECT qms_public_tracking_document($1,$2,$3)',[c.id,a.nonce,file]),'42501','Revocation blocks download')
  // Leer, emitir y descargar usan el mismo límite exclusivo; el reloj de una
  // transacción es estable y permite verificar un microsegundo y el punto exacto.
  const boundary=await pool.connect()
  try {
    await boundary.query('BEGIN');await boundary.query('SET LOCAL ROLE service_role')
    const guarded=[['SELECT qms_public_tracking_read($1,$2)',[c.id,a.nonce]],['SELECT qms_public_tracking_access($1)',[c.id]],['SELECT qms_public_tracking_document($1,$2,$3)',[c.id,a.nonce,file]]]
    for(const [offset,label] of [[1,'just before'],[0,'exactly at'],[-1,'after']]) {
      await boundary.query("UPDATE queja_public_access SET revoked_at=NULL,closed_at=now()+$2*interval '1 microsecond'-interval '720 hours',expires_at=now()+$2*interval '1 microsecond' WHERE queja_id=$1",[c.id,offset])
      for(const [sql,args] of guarded) {
        if(offset>0)check((await boundary.query(sql,args)).rowCount===1,'Public access allowed '+label+' expiry')
        else {await boundary.query('SAVEPOINT expired_read');await rejects(()=>boundary.query(sql,args),'42501','Public access denied '+label+' expiry');await boundary.query('ROLLBACK TO SAVEPOINT expired_read')}
      }
    }
  } finally {await boundary.query('ROLLBACK');boundary.release()}
  await pool.query("UPDATE queja_public_access SET revoked_at=NULL,closed_at=now()-interval '720 hours 1 second',expires_at=now()-interval '1 second' WHERE queja_id=$1",[c.id])
  await rejects(()=>read(a),'42501','Expiry blocks read')
  await rejects(()=>access(c.id),'42501','Access retry does not extend expiry')
  const expiredNew=await newCase(),expiredFile=await attach(expiredNew)
  const expiredWork=await transition(expiredNew,'investigation',{justification:'Private initial decision',owner:actors.owner.id})
  const expiredPublication=await publish(expiredWork,expiredFile,{state:'resolved'})
  const expiredCase=await transition(expiredPublication,'finished'),expiredLink=await access(expiredCase.id)
  await pool.query("UPDATE queja_public_access SET closed_at=now()-interval '720 hours 1 second',expires_at=now()-interval '1 second' WHERE queja_id=$1",[expiredCase.id])
  const expiredBefore=await accessRow(expiredCase.id)
  const expiredReopened=await transition(expiredCase,'investigation',{reopen:'Private reopen after expiry',owner:actors.owner.id})
  check(expiredReopened.estado==='En Investigación','Expiry does not prevent authenticated internal work')
  await rejects(()=>read(expiredLink),'42501','Reopening cannot reactivate an expired public link')
  await rejects(()=>access(expiredCase.id),'42501','Issuing a link after reopening cannot renew its expired window')
  const expiredResolved=await publish(expiredReopened,expiredFile,{state:'resolved'})
  await transition(expiredResolved,'finished')
  check((await accessRow(expiredCase.id)).closed_at.getTime()===expiredBefore.closed_at.getTime(),'Closing again preserves original closure anchor')
  await rejects(()=>service('SELECT qms_public_tracking_document($1,$2,$3)',[expiredCase.id,expiredLink.nonce,expiredFile]),'42501','Even a newly approved document is locked after original expiry')

  // Fechas anteriores al seguimiento no se regeneran al primer acceso. Estos
  // expedientes son sintéticos; solo se retira su fila de capacidad de fixture.
  let historical=await newCase()
  historical=await transition(historical,'rejected',{office:'HIST-'+historical.folio,resolution:'Historic response'})
  await historicalCase(historical,100,10)
  await pool.query('DELETE FROM queja_public_access WHERE queja_id=$1',[historical.id])
  const historicalAccess=await access(historical.id),historicalRow=await accessRow(historical.id)
  check((await read(historicalAccess)).folio===historical.folio,'Recent historic closure can still be consulted')
  check(Math.abs(Date.now()-historicalRow.closed_at.getTime()-10*86400000)<10000,'Historic countdown anchors actual recorded closure, not first query')
  check(historicalRow.expires_at-historicalRow.closed_at===30*86400000,'Historic closure uses the same thirty natural days')
  await historicalCase(historical,100,40)
  await pool.query('DELETE FROM queja_public_access WHERE queja_id=$1',[historical.id])
  await service('SELECT qms_ensure_public_tracking_access($1)',[historical.id])
  const oldHistoric=await accessRow(historical.id)
  await rejects(()=>access(historical.id),'42501','First query cannot renew an already expired historic case')
  await rejects(()=>read({queja_id:historical.id,nonce:oldHistoric.nonce}),'42501','Expired historic access cannot be read')
  for(const [days,label] of [[null,'unknown'],[-1,'future'],[150,'before receipt']]) {
    await historicalCase(historical,100,days)
    await pool.query('DELETE FROM queja_public_access WHERE queja_id=$1',[historical.id])
    await service('SELECT qms_ensure_public_tracking_access($1)',[historical.id])
    check((await accessRow(historical.id)).revoked_at!==null,'Historic '+label+' closure fails closed')
    await rejects(()=>access(historical.id),'42501','Historic '+label+' closure does not receive a new month')
  }

  // Ejecutar ambas intercalaciones con el mismo lock de expediente: cerrar antes
  // de crear el enlace y crear el enlace antes de cerrar. Sin sleeps ni reloj falso.
  for(const order of ['close-first','access-first']) {
    const raceNew=await newCase(),raceWork=await transition(raceNew,'investigation',{justification:'Race fixture',owner:actors.owner.id})
    const raceFile=await attach(raceWork),racePublished=await publish(raceWork,raceFile,{state:'resolved'})
    // Terminar la preparación de datos ficticios antes de capturar revisión CAS.
    const raceResolved=await historicalCase(racePublished,100,10)
    await pool.query('DELETE FROM queja_public_access WHERE queja_id=$1',[raceResolved.id])
    const owner=await pool.connect();let waiting,result,original
    try {
      await owner.query('BEGIN');await owner.query('SELECT id FROM quejas WHERE id=$1 FOR UPDATE',[raceResolved.id])
      if(order==='close-first') {
        waiting=access(raceResolved.id)
        await owner.query('SET LOCAL ROLE authenticated')
        await owner.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actors.admin.auth])
        await owner.query('SELECT qms_transition_complaint($1,$2,$3)',[raceResolved.id,raceResolved.revision,'finished'])
      } else {
        await owner.query('SET LOCAL ROLE service_role')
        original=(await owner.query('SELECT qms_public_tracking_access($1) value',[raceResolved.id])).rows[0].value
        waiting=transition(raceResolved,'finished')
      }
      await owner.query('COMMIT');result=await waiting
    } finally {await owner.query('ROLLBACK');owner.release()}
    const finalAccess=await accessRow(raceResolved.id)
    check(finalAccess.closed_at!==null&&finalAccess.expires_at-finalAccess.closed_at===30*86400000,'Concurrent '+order+' always persists exact closure window')
    check(Date.now()-finalAccess.closed_at.getTime()<10000,'Live '+order+' closure ignores stale legacy fecha_cierre')
    check((order==='close-first'?result.nonce:original.nonce)===finalAccess.nonce,'Concurrent '+order+' preserves one stable link')
  }
  let investigation=await newCase(),ia=await access(investigation.id),ifile=await attach(investigation)
  investigation=await transition(investigation,'investigation',{justification:'INTERNAL REASON',owner:actors.owner.id})
  investigation=await transition(investigation,'quality_review',{resolution:'INTERNAL DRAFT'},actors.owner)
  check((await read(ia)).respuesta===null,'Investigator draft never public')
  investigation=await publish(investigation,ifile,{state:'resolved',response:'Final approved response.'})
  check((await accessRow(investigation.id)).expires_at===null,'Resuelto is intermediate and does not start countdown')
  check((await read(ia)).etapas.some(e=>e.nombre==='Investigación'),'Investigation milestone from persisted start')
  const finalMailCount=(await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE queja_id=$1",[investigation.id])).rows[0].n
  investigation=await transition(investigation,'finished')
  const firstClosure=await accessRow(investigation.id)
  check(firstClosure.closed_at!==null&&firstClosure.expires_at-firstClosure.closed_at===30*86400000,'Finalizado starts thirty natural days')
  check((await pool.query("SELECT count(*)::int n FROM queja_mail_outbox WHERE queja_id=$1",[investigation.id])).rows[0].n===finalMailCount,'Closure does not create another email')
  check((await read(ia)).etapas.some(e=>e.nombre==='Cierre'),'Closure milestone')
  investigation=await transition(investigation,'investigation',{reopen:'INTERNAL REOPEN'})
  check((await read(ia)).respuesta===null&&(await read(ia)).documento===null,'Reopened case hides earlier final publication')
  check(!JSON.stringify(await read(ia)).includes('INTERNAL'),'No internal reasons or drafts in timeline')
  await rejects(()=>service('SELECT qms_public_tracking_document($1,$2,$3)',[investigation.id,ia.nonce,ifile]),'42501','Reopened final not downloadable')
  investigation=await transition(investigation,'resolved',{resolution:'LEGACY SECOND RESOLUTION'})
  check((await read(ia)).respuesta===null&&(await read(ia)).documento===null,'Old client cannot revive publication from previous investigation')
  await rejects(()=>service('SELECT qms_public_tracking_document($1,$2,$3)',[investigation.id,ia.nonce,ifile]),'42501','Previous investigation file remains unavailable after legacy re-resolution')
  check(!(await read(ia)).etapas.some(e=>e.nombre==='Respuesta'),'Old publication is not presented as current response milestone')
  investigation=await transition(investigation,'investigation',{reopen:'Second private reopen'})
  investigation=await publish(investigation,ifile,{state:'resolved',response:'New approved public response.'})
  check((await read(ia)).respuesta==='New approved public response.','Current investigation publication becomes available')
  check((await read(ia)).etapas.filter(e=>e.nombre==='Investigación').length===1&&(await read(ia)).etapas.length<=4,'Timeline remains minimal across reopen cycles')
  investigation=await transition(investigation,'finished')
  check((await accessRow(investigation.id)).expires_at.getTime()===firstClosure.expires_at.getTime(),'Reopen and second closure never extend first deadline')
  check(!(await read(ia)).etapas.some(e=>e.nombre==='Cierre'),'Legacy stale closure timestamp is omitted instead of invented')
  const immutable=(await pool.query("SELECT public_tracking FROM queja_mail_outbox WHERE queja_id=$1 AND tipo='recibido'",[investigation.id])).rows[0].public_tracking
  check(immutable.nonce===ia.nonce&&Object.keys(immutable).sort().join(',')==='nonce,queja_id','Mail captures only stable same-link claims, no expiry snapshot')
  await pool.query('UPDATE queja_public_access SET nonce=gen_random_uuid() WHERE queja_id=$1',[investigation.id])
  check((await pool.query("SELECT public_tracking FROM queja_mail_outbox WHERE queja_id=$1 AND tipo='recibido'",[investigation.id])).rows[0].public_tracking.nonce===immutable.nonce,'Changing access does not change queued payload')
  await pool.query("UPDATE queja_mail_outbox SET next_attempt_at=now()+interval '1 hour' WHERE tipo='recibido' AND queja_id<>$1",[legacy.id])
  const legacyBatch=await service('SELECT * FROM qms_mail_claim_batch_v3($1,120,$2,$3)',[5,randomUUID(),Math.floor(Date.now()/1000)])
  check(legacyBatch.some(x=>x.folio===legacy.folio&&x.public_tracking===null),'Legacy mail stays snapshot-null under v3')
  await pool.query("UPDATE queja_mail_outbox SET next_attempt_at=now() WHERE status='pending'")
  const batch=await service('SELECT * FROM qms_mail_claim_batch_v3($1,120,$2,$3)',[5,randomUUID(),Math.floor(Date.now()/1000)])
  check(batch.length>0&&batch.some(x=>x.public_tracking!==null),'v3 claim includes optional immutable snapshot')
  check(batch.every(x=>Object.keys(x).sort().join(',')==='claim_token,destinatario,estado,folio,id,numero_oficio,public_tracking,tipo'),'v3 projection adds no private source columns')
  check(batch.find(x=>x.queja_id===legacy.id)===undefined,'Claim never adds case UUID outside optional snapshot')
  check((await pool.query("SELECT pg_get_function_result('qms_mail_claim_batch_v2(integer,integer,uuid,bigint)'::regprocedure) value")).rows[0].value==='TABLE(id uuid, claim_token uuid, tipo text, destinatario text, folio text, estado text, numero_oficio text)','v2 return contract unchanged')
  // Ejecutar el corte real únicamente en este clúster sintético. La migración
  // anterior debe conservar compatibilidad hasta la publicación coordinada.
  const oldClientCase=await newCase()
  const oldClientDone=await transition(oldClientCase,'rejected',{office:'OLD-'+oldClientCase.folio,resolution:'Old compatible response'})
  check(oldClientDone.estado==='No Procede','Additive migration preserves old client before coordinated cut')
  const oldResolvedNew=await newCase()
  const oldResolvedInvestigation=await transition(oldResolvedNew,'investigation',{justification:'Private old decision',owner:actors.owner.id})
  const oldResolved=await transition(oldResolvedInvestigation,'resolved',{office:'OLD-'+oldResolvedNew.folio,resolution:'Historical resolution without published file'})
  await pool.query(fs.readFileSync('scripts/activar-publicacion-quejas.sql','utf8'))
  check((await pool.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='quejas'::regclass AND tgname='zz_qms_require_published_resolution' AND NOT tgisinternal")).rows[0].n===1,'Coordinated cut installs terminal guard once')
  for(const role of ['anon','authenticated','service_role'])check(!(await pool.query("SELECT has_function_privilege($1,'qms_require_published_resolution()','EXECUTE') allowed",[role])).rows[0].allowed,'Trigger function cannot be invoked by '+role)
  await pool.query(fs.readFileSync('scripts/activar-publicacion-quejas.sql','utf8'))
  check((await pool.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='quejas'::regclass AND tgname='zz_qms_require_published_resolution' AND NOT tgisinternal")).rows[0].n===1,'Reapplying coordinated cut does not duplicate guard')
  const cutCase=await newCase(),cutFile=await attach(cutCase),cutAccess=await access(cutCase.id)
  await rejects(()=>transition(cutCase,'rejected',{office:'CUT-'+cutCase.folio,resolution:'Legacy rejection'}),'55000','Old client cannot reject without publication after cut')
  check((await accessRow(cutCase.id)).closed_at===null,'Rejected terminal update rolls closure-trigger writes back atomically')
  check(String((await pool.query('SELECT revision FROM quejas WHERE id=$1',[cutCase.id])).rows[0].revision)===String(cutCase.revision),'Failed legacy decision rolls metadata revision back')
  await rejects(()=>pool.query("UPDATE quejas SET estado='No Procede' WHERE id=$1",[cutCase.id]),'55000','Direct terminal state update cannot bypass publication')
  await rejects(()=>transition(oldResolved,'finished'),'55000','Historical resolved case without official publication cannot finish after cut')
  const cutWork=await transition(cutCase,'investigation',{justification:'Private new decision',owner:actors.owner.id})
  const cutPublished=await publish(cutWork,cutFile,{state:'resolved'})
  check(cutPublished.estado==='Resuelto'&&(await read(cutAccess)).respuesta==='Respuesta oficial pública.','Publication wrapper remains usable after terminal guard')
  const cutPublication=(await pool.query('SELECT source_revision,publication_txid FROM queja_public_resolutions WHERE queja_id=$1',[cutCase.id])).rows[0]
  check(String(cutPublication.source_revision)===String(cutWork.revision)&&BigInt(cutPublication.publication_txid)>0n,'Publication captures original revision and real transaction ID')
  const cutFinished=await transition(cutPublished,'finished')
  check(cutFinished.estado==='Finalizado','Closing an approved current publication remains allowed')
  let cutReopened=await transition(cutFinished,'investigation',{reopen:'Private reopen',owner:actors.owner.id})
  await rejects(()=>transition(cutReopened,'resolved',{resolution:'Recycle old publication'}),'55000','Publication from a previous transaction and investigation cannot be recycled')
  await rejects(()=>pool.query("UPDATE quejas SET estado='Resuelto' WHERE id=$1",[cutReopened.id]),'55000','Direct resolution cannot recycle earlier publication')
  const republished=await publish(cutReopened,cutFile,{state:'resolved',response:'Approved again after reopen.'})
  check(republished.estado==='Resuelto'&&(await read(cutAccess)).respuesta==='Approved again after reopen.','Fresh publication after reopen succeeds with original revision')
  await rejects(()=>publish(cutReopened,cutFile,{state:'resolved',response:'Late stale response.'}),'40001','Late stale publisher cannot replace accepted final response')
  check((await read(cutAccess)).respuesta==='Approved again after reopen.','Stale publication preserves previously accepted public response')
  const sameTxNew=await newCase(),sameTxCase=await transition(sameTxNew,'investigation',{justification:'Private original decision',owner:actors.owner.id}),sameTxFile=await attach(sameTxCase),sameTx=await pool.connect()
  try {
    await sameTx.query('BEGIN');await sameTx.query('SET LOCAL ROLE authenticated')
    await sameTx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actors.admin.auth])
    const initial=(await sameTx.query('SELECT qms_resolve_complaint_with_document($1,$2,$3,$4,$5,$6) value',[sameTxCase.id,'resolved',{office_number:'TX-'+sameTxCase.folio},sameTxCase.revision,sameTxFile,'First response in transaction'])).rows[0].value
    const reopened=(await sameTx.query('SELECT qms_transition_complaint($1,$2,$3,NULL,NULL,$4,$5) value',[sameTxCase.id,initial.revision,'investigation',actors.owner.id,'Private reopen in same TX'])).rows[0].value
    await sameTx.query('SAVEPOINT stale_publication')
    await rejects(()=>sameTx.query('SELECT qms_transition_complaint($1,$2,$3,$4) value',[sameTxCase.id,reopened.revision,'resolved','Reuse publication in same TX']),'55000','Same transaction ID alone cannot authorize an old publication after reopen')
    await sameTx.query('ROLLBACK TO SAVEPOINT stale_publication')
    const renewed=(await sameTx.query('SELECT qms_resolve_complaint_with_document($1,$2,$3,$4,$5,$6) value',[sameTxCase.id,'resolved',{office_number:'TX-'+sameTxCase.folio},reopened.revision,sameTxFile,'Fresh publication in same TX'])).rows[0].value
    check(renewed.estado==='Resuelto','Fresh wrapper publication in same transaction is allowed')
  } finally {await sameTx.query('ROLLBACK');sameTx.release()}
  const result={ok:true,checks,at:new Date().toISOString(),scope:'Public tracking, final document publication and mail capability snapshots; isolated PostgreSQL; no remote writes'}
  console.log(JSON.stringify(result));fs.writeFileSync(path.join(root,'.performance/quejas-public-tracking-db-evidence.json'),JSON.stringify(result,null,2))
} finally {if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-w','stop','-m','fast'])}
