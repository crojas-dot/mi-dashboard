// DB local aislada con datos sintéticos. Nunca carga .env ni consulta un proyecto remoto.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const root=process.cwd(),bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin'
const work=path.join(root,'.performance','drive-registry-db-'+Date.now()),data=path.join(work,'data'),port=55449
const {Pool}=createRequire(path.join(root,'.performance/load-tools/package.json'))('pg')
const password=randomBytes(32).toString('hex')
let pool,started=false,checks=0
function run(binary,args){const r=spawnSync(path.join(bin,binary),args,{encoding:'utf8',stdio:'ignore',windowsHide:true,timeout:60000});if(r.status!==0)throw new Error('PostgreSQL fixture command failed')}
function check(c,m){assert.ok(c,m);checks++}
async function reject(fn,code,m){await assert.rejects(fn,e=>e.code===code,m);checks++}
async function as(role,sql,args=[],auth=null){const c=await pool.connect();try{await c.query('SET ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[auth??'']);return(await c.query(sql,args)).rows}finally{await c.query('RESET ROLE');c.release()}}
const admin=randomUUID(),quality=randomUUID(),owner=randomUUID(),other=randomUUID(),inactive=randomUUID(),unknown=randomUUID(),unlinked=randomUUID(),caseId=randomUUID(),caseOther=randomUUID(),caseUnassigned=randomUUID()
const rpc='SELECT to_jsonb(public.registrar_adjunto_queja_servidor($1,$2,$3,$4,$5,$6)) AS value'
function args(actor=admin,q=caseId,file='fixture_file_'+randomUUID().replaceAll('-',''),size=128){return[actor,q,'fixture.pdf',file,size,'application/pdf']}
async function prepareStorageFixture(migrationSql){
 const registeredPath=caseId+'/registered-fixture.pdf',objectId=randomUUID(),missingProfile=randomUUID()
 await pool.query(`
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_user::text$$;
 CREATE TABLE public.fixture_role_module_read(rol text NOT NULL,modulo text NOT NULL,PRIMARY KEY(rol,modulo));
 REVOKE ALL ON public.fixture_role_module_read FROM PUBLIC,anon,authenticated;
 INSERT INTO public.fixture_role_module_read VALUES('colaborador','mis_quejas');
 CREATE FUNCTION public.app_tiene_permiso(p_modulo text,p_escritura boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.usuarios u WHERE u.auth_id=auth.uid() AND u.estado='activo' AND
   (u.rol IN('admin','calidad') OR (NOT p_escritura AND EXISTS(SELECT 1 FROM public.fixture_role_module_read p WHERE p.rol=u.rol AND p.modulo=p_modulo))))
 $$;
 ALTER TABLE public.quejas ENABLE ROW LEVEL SECURITY;
 CREATE POLICY fixture_quejas_staff_select ON public.quejas FOR SELECT TO authenticated USING(public.app_es_staff());
 CREATE POLICY fixture_quejas_owner_select ON public.quejas FOR SELECT TO authenticated USING(public.app_es_colaborador() AND public.app_tiene_permiso('mis_quejas',false) AND responsable_id=public.app_usuario_actual_id());
 CREATE SCHEMA storage;GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean NOT NULL DEFAULT false);
 INSERT INTO storage.buckets VALUES('quejas-adjuntos',false),('other-fixture-bucket',false);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL,name text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',UNIQUE(bucket_id,name));
 GRANT ALL ON storage.objects TO anon,authenticated,service_role;
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Staff puede leer archivos" ON storage.objects FOR SELECT TO PUBLIC USING(bucket_id='quejas-adjuntos' AND auth.role()='authenticated');
 CREATE POLICY "Staff puede subir archivos" ON storage.objects FOR INSERT TO PUBLIC WITH CHECK(bucket_id='quejas-adjuntos' AND auth.role()='authenticated');
 CREATE POLICY fixture_other_bucket_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='other-fixture-bucket');
 CREATE POLICY fixture_other_bucket_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='other-fixture-bucket');
 CREATE POLICY fixture_other_bucket_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='other-fixture-bucket') WITH CHECK(bucket_id='other-fixture-bucket');
 CREATE POLICY fixture_other_bucket_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='other-fixture-bucket');
 `)
 await pool.query("INSERT INTO public.queja_adjuntos(queja_id,nombre_archivo,storage_path) VALUES($1,'registered-fixture.pdf',$2)",[caseId,registeredPath])
 await pool.query("INSERT INTO storage.objects(id,bucket_id,name) VALUES($1,'quejas-adjuntos',$2),(gen_random_uuid(),'quejas-adjuntos',$3),(gen_random_uuid(),'quejas-adjuntos',$4),(gen_random_uuid(),'other-fixture-bucket',$2)",[objectId,registeredPath,caseId+'/unregistered-fixture.pdf',registeredPath+'.extra'])
 check((await as('authenticated',"SELECT id FROM storage.objects WHERE bucket_id='quejas-adjuntos'",[],missingProfile)).length===3,'Fixture reproduces legacy Storage read by Auth identity without profile')
 check((await as('authenticated',"INSERT INTO storage.objects(bucket_id,name) VALUES('quejas-adjuntos','legacy-unprofiled-upload.pdf') RETURNING id",[],missingProfile)).length===1,'Fixture reproduces legacy Storage upload by Auth identity without profile')
 await pool.query("DELETE FROM storage.objects WHERE name='legacy-unprofiled-upload.pdf'")
 const otherPolicies=await pool.query("SELECT policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'fixture_other_bucket_%' ORDER BY policyname")
 await pool.query(migrationSql)
 assert.deepEqual((await pool.query("SELECT policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'fixture_other_bucket_%' ORDER BY policyname")).rows,otherPolicies.rows,'Migration preserves unrelated bucket policies');checks++
 return async function verifyStorageAccess(phase){
  for(const actor of[admin,quality,owner])check((await as('authenticated',"SELECT id FROM storage.objects WHERE bucket_id='quejas-adjuntos' AND name=$1",[registeredPath],actor)).length===1,phase+': staff and assigned active owner can read exact registered Storage object')
  for(const actor of[other,inactive,unknown,unlinked,missingProfile])check((await as('authenticated',"SELECT id FROM storage.objects WHERE bucket_id='quejas-adjuntos'",[],actor)).length===0,phase+': other/inactive/unknown/unlinked/no-profile identity cannot read Storage objects')
  check((await as('anon',"SELECT id FROM storage.objects WHERE bucket_id='quejas-adjuntos'")).length===0,phase+': anon cannot read Storage object')
  check((await as('authenticated',"SELECT name FROM storage.objects WHERE bucket_id='quejas-adjuntos'",[],admin)).length===1,phase+': unregistered object and prefix lookalike are denied even to active staff')
  await pool.query("DELETE FROM public.fixture_role_module_read WHERE rol='colaborador' AND modulo='mis_quejas'")
  check((await as('authenticated',"SELECT id FROM storage.objects WHERE bucket_id='quejas-adjuntos'",[],owner)).length===0,phase+': assigned collaborator without module read permission cannot read file')
  await pool.query("INSERT INTO public.fixture_role_module_read VALUES('colaborador','mis_quejas')")
  for(const actor of[admin,owner,inactive,missingProfile]){
   await reject(()=>as('authenticated',"INSERT INTO storage.objects(bucket_id,name) VALUES('quejas-adjuntos',$1)",['forged-'+randomUUID()+'.pdf'],actor),'42501',phase+': direct Storage INSERT denied')
   check((await as('authenticated',"UPDATE storage.objects SET metadata='{\"tampered\":true}' WHERE id=$1 RETURNING id",[objectId],actor)).length===0,phase+': direct Storage UPDATE changes no objects')
   check((await as('authenticated','DELETE FROM storage.objects WHERE id=$1 RETURNING id',[objectId],actor)).length===0,phase+': direct Storage DELETE changes no objects')
  }
  await reject(()=>as('anon',"INSERT INTO storage.objects(bucket_id,name) VALUES('quejas-adjuntos','anon-forged.pdf')"),'42501',phase+': anon Storage INSERT denied')
  check((await as('anon','UPDATE storage.objects SET name=$1 WHERE id=$2 RETURNING id',['anon-forged.pdf',objectId])).length===0,phase+': anon Storage UPDATE changes no objects')
  check((await as('anon','DELETE FROM storage.objects WHERE id=$1 RETURNING id',[objectId])).length===0,phase+': anon Storage DELETE changes no objects')
  for(const role of['anon','authenticated']){
   for(const privilege of['TRUNCATE','REFERENCES','TRIGGER'])check(!(await pool.query("SELECT has_table_privilege($1,'storage.objects',$2) ok",[role,privilege])).rows[0].ok,phase+': client has no RLS-bypassing '+privilege+' privilege')
   await reject(()=>as(role,'TRUNCATE storage.objects',[],admin),'42501',phase+': real TRUNCATE command denied')
  }
  const untouched=(await pool.query('SELECT name,metadata FROM storage.objects WHERE id=$1',[objectId])).rows[0]
  check(untouched?.name===registeredPath&&Object.keys(untouched.metadata).length===0,phase+': rejected client writes leave registered object intact')
  check((await as('authenticated',"SELECT id FROM storage.objects WHERE bucket_id='other-fixture-bucket' AND name=$1",[registeredPath],missingProfile)).length===1,phase+': same name in unrelated bucket retains its existing read policy')
  const otherObject=(await as('authenticated',"INSERT INTO storage.objects(bucket_id,name) VALUES('other-fixture-bucket',$1) RETURNING id",['other-'+randomUUID()],missingProfile))[0]
  check(!!otherObject?.id,phase+': unrelated bucket INSERT remains allowed')
  check((await as('authenticated',"UPDATE storage.objects SET metadata='{\"fixture\":true}' WHERE id=$1 RETURNING id",[otherObject.id],missingProfile)).length===1,phase+': unrelated bucket UPDATE remains allowed')
  check((await as('authenticated','DELETE FROM storage.objects WHERE id=$1 RETURNING id',[otherObject.id],missingProfile)).length===1,phase+': unrelated bucket DELETE remains allowed')
 }
}
try{
 fs.mkdirSync(work,{recursive:true});const pw=path.join(work,'pw');fs.writeFileSync(pw,password)
 run('initdb.exe',['-D',data,'-U','qms_fixture','-A','scram-sha-256','--pwfile='+pw,'--encoding=UTF8','--locale=C']);fs.unlinkSync(pw)
 run('pg_ctl.exe',['-D',data,'-l',path.join(work,'postgres.log'),'-o','-h 127.0.0.1 -p '+port+' -c max_connections=80','-w','start']);started=true
 pool=new Pool({host:'127.0.0.1',port,user:'qms_fixture',password,database:'postgres',max:30,statement_timeout:15000})
 await pool.query(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
 CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TABLE public.usuarios(id uuid PRIMARY KEY,auth_id uuid,rol text NOT NULL,estado text);
 CREATE TABLE public.quejas(id uuid PRIMARY KEY,folio text NOT NULL,responsable_id uuid,estado text);
 CREATE TABLE public.queja_adjuntos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),queja_id uuid NOT NULL REFERENCES public.quejas(id),nombre_archivo text NOT NULL,url_archivo text,tipo_archivo text,tamano integer,subido_por uuid,fecha_subida timestamptz DEFAULT now(),nombre text NOT NULL DEFAULT '',storage_path text NOT NULL DEFAULT '',tipo_mime text NOT NULL DEFAULT 'application/octet-stream',usuario_id uuid,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),fecha timestamptz,usuario_id uuid,accion text,modulo text,detalle text);
 CREATE TABLE public.formularios_publicos(id uuid PRIMARY KEY);
 ALTER TABLE public.queja_adjuntos ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION public.app_es_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE auth_id=auth.uid() AND estado='activo' AND rol IN ('admin','calidad'))$$;
 CREATE FUNCTION public.app_es_colaborador() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE auth_id=auth.uid() AND estado='activo' AND rol='colaborador')$$;
 CREATE FUNCTION public.app_usuario_actual_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT id FROM public.usuarios WHERE auth_id=auth.uid() AND estado='activo' LIMIT 1$$;
 CREATE POLICY "Staff puede ver adjuntos" ON public.queja_adjuntos FOR SELECT USING(public.app_es_staff());
 CREATE POLICY "Staff puede subir adjuntos" ON public.queja_adjuntos FOR INSERT WITH CHECK(public.app_es_staff());
 CREATE POLICY queja_adjuntos_staff_select ON public.queja_adjuntos FOR SELECT TO authenticated USING(public.app_es_staff());
 CREATE POLICY queja_adjuntos_colaborador_propias ON public.queja_adjuntos FOR SELECT TO authenticated USING(public.app_es_colaborador() AND EXISTS(SELECT 1 FROM public.quejas q WHERE q.id=queja_id AND q.responsable_id=public.app_usuario_actual_id()));
 `)
 // Reusar las definiciones aplicadas de las dos tablas públicas evita inventar una columna queja_id en uploads.
 const publicDDL=fs.readFileSync('supabase/migrations/20261008224037_public_forms_gateway.sql','utf8').split('CREATE TABLE public.public_form_rate_limits')[0];
 await pool.query(publicDDL);
 await pool.query('ALTER TABLE public.public_form_submissions ENABLE ROW LEVEL SECURITY;ALTER TABLE public.public_form_uploads ENABLE ROW LEVEL SECURITY;REVOKE ALL ON public.public_form_submissions,public.public_form_uploads FROM PUBLIC,anon,authenticated');
 await reject(()=>pool.query('SELECT queja_id FROM public.public_form_uploads'),'42703','Fixture follows real schema: queja_id belongs to submissions, not uploads');
 const snapshot=JSON.parse(fs.readFileSync('supabase/backups/drive_registry_preflight_20261008.json','utf8'))
 for(const f of snapshot.functions)await pool.query(f.definition)
 // El cutover coordinado se ejecuta entero, con las firmas públicas reales y las privadas.
 const publicLegacySnapshot=JSON.parse(fs.readFileSync('supabase/backups/public_forms_gateway_preflight_20261008.json','utf8'))
 for(const f of publicLegacySnapshot.functions)await pool.query(f.definition)
 await pool.query(`
 ALTER TABLE public.formularios_publicos ADD COLUMN activo boolean NOT NULL DEFAULT true;
 ALTER TABLE public.formularios_publicos ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION public.app_es_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE auth_id=auth.uid() AND estado='activo' AND rol='admin')$$;
 CREATE POLICY formularios_publicos_active_select ON public.formularios_publicos FOR SELECT TO anon,authenticated USING(activo);
 CREATE POLICY formularios_publicos_admin_write ON public.formularios_publicos FOR ALL TO authenticated USING(public.app_es_admin()) WITH CHECK(public.app_es_admin());
 CREATE FUNCTION public.crear_queja_publica_con_atributos(text,text,text,text,text,text) RETURNS text LANGUAGE sql AS $$SELECT 'fixture'$$;
 CREATE FUNCTION public.crear_queja_publica_con_atributos(text,text,text,text,text,text,text) RETURNS text LANGUAGE sql AS $$SELECT 'fixture'$$;
 `)
 // Esas funciones históricas se capturaron con ACL específicos, no con defaults de fixtures.
 await pool.query('REVOKE ALL ON FUNCTION public.registrar_adjunto_queja(uuid,text,text,bigint,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.registrar_adjunto_queja(uuid,text,text,bigint,text) TO authenticated,service_role')
 for(const [id,rol,estado,linked]of[[admin,'admin','activo',true],[quality,'calidad','activo',true],[owner,'colaborador','activo',true],[other,'colaborador','activo',true],[inactive,'admin','inactivo',true],[unknown,'externo','activo',true],[unlinked,'admin','activo',false]])await pool.query('INSERT INTO public.usuarios VALUES ($1,$2,$3,$4)',[id,linked?id:null,rol,estado])
 await pool.query('INSERT INTO public.quejas VALUES($1,$2,$3,$4),($5,$6,$7,$4)',[caseId,'F-fixture',owner,'En Investigación',caseOther,'F-other',other])
 await pool.query('INSERT INTO public.quejas VALUES($1,$2,NULL,$3)',[caseUnassigned,'F-unassigned','Recibido']);
 await pool.query(fs.readFileSync('supabase/migrations/20261009034402_drive_attachment_server_registry.sql','utf8'))
 await pool.query(fs.readFileSync('supabase/migrations/20261009034819_drive_attachment_public_quota_scope.sql','utf8'));
 const first=args();const inserted=(await as('service_role',rpc,first))[0].value
 check(inserted.usuario_id===admin&&inserted.nombre===first[2]&&inserted.storage_path===first[3]&&inserted.url_archivo===first[3],'New API registry preserves owner and raw Drive ID')
 check((await as('service_role',rpc,first))[0].value.id===inserted.id,'Same known Drive file retry same metadata row')
 check((await pool.query('SELECT count(*)::int n FROM public.logs')).rows[0].n===1,'Repeated commit does not duplicate audit')
 for(const actor of[quality,owner])check((await as('service_role',rpc,args(actor)))[0].value.usuario_id===actor,'Quality and assigned collaborator retain upload permissions')
 for(const actor of[other,inactive,unknown,unlinked,randomUUID()])await reject(()=>as('service_role',rpc,args(actor)),'42501','Other/inactive/unknown/unlinked caller denied')
 await reject(()=>as('service_role',rpc,args(owner,caseUnassigned)),'42501','Collaborator cannot upload to unassigned case through SQL NULL truth value');
 await reject(()=>as('service_role',rpc,args(admin,randomUUID())),'42501','Missing case denied')
 for(const [index,value]of[[2,'../x.pdf'],[2,'x\\y.pdf'],[2,'x\nx.pdf'],[2,'x'.repeat(256)],[3,'https://example.invalid/file'],[3,'drive:invalid_id'],[4,0],[4,4194305],[5,'application/pdf\r\ntext/plain']])await reject(()=>as('service_role',rpc,first.map((x,i)=>i===index?value:x)),'22023','Invalid metadata or path denied')
 await reject(()=>as('service_role',rpc,first.map((x,i)=>i===2?'changed.pdf':x)),'23505','Same file cannot silently change metadata')
 for(const role of['anon','authenticated'])await reject(()=>as(role,rpc,args(admin),admin),'42501','Service RPC forbidden to client, even with claimed admin UUID')
 const parallel=await Promise.allSettled(Array.from({length:15},()=>as('service_role',rpc,args(admin))))
 check(parallel.filter(x=>x.status==='fulfilled').length===7,'Parallel private commits cannot exceed ten including three prior rows')
 check(parallel.filter(x=>x.status==='rejected').every(x=>x.reason.code==='54000'),'Private quota error stable')
 check((await pool.query('SELECT count(*)::int n FROM public.queja_adjuntos WHERE queja_id=$1',[caseId])).rows[0].n===10,'Total private count capped')
 const formId=randomUUID(),submissionId=randomUUID();
 await pool.query('INSERT INTO public.formularios_publicos(id) VALUES($1)',[formId]);
 await pool.query('INSERT INTO public.public_form_submissions(form_id,submission_id,payload_hash,queja_id) VALUES($1,$2,$3,$4)',[formId,submissionId,'0'.repeat(64),caseOther]);
 await pool.query("INSERT INTO public.public_form_uploads(form_id,submission_id,upload_id,content_hash,nombre,tipo_mime,status,tamano) SELECT $1,$2,gen_random_uuid(),$3,'fixture.pdf','application/pdf','reserved',4194304 FROM generate_series(1,10)",[formId,submissionId,'1'.repeat(64)])
 await reject(()=>as('service_role',rpc,args(admin,caseOther)),'54000','Public pending reservations consume private quota')
 await pool.query("UPDATE public.public_form_uploads SET status='released' WHERE form_id=$1 AND submission_id=$2",[formId,submissionId])
 check((await as('service_role',rpc,args(admin,caseOther)))[0].value.id,'Released reservation restores quota')
 const verifyStorageAccess=await prepareStorageFixture(fs.readFileSync('supabase/migrations/20261009230746_public_storage_access_hardening.sql','utf8'))
 await verifyStorageAccess('Before Drive metadata cutover')
 const combinedCutover=fs.readFileSync('supabase/migrations/20261009231000_public_forms_drive_access_cutover.sql','utf8')
 // Un fallo tardío dentro del DO no puede dejar el gateway cerrado y Drive a medio cortar.
 await pool.query('DROP POLICY "Staff puede subir adjuntos" ON public.queja_adjuntos')
 await reject(()=>pool.query(combinedCutover),'42704','Whole combined cutover rolls back when a final required policy is missing')
 check((await pool.query("SELECT has_function_privilege('anon','public.crear_queja_publica(text,text,text,text,text,text)','EXECUTE') ok")).rows[0].ok,'Failed atomic cutover restores earlier public function ACL')
 check((await pool.query("SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename='formularios_publicos' AND policyname='formularios_publicos_active_select'")).rows[0].n===1,'Failed atomic cutover restores earlier public metadata policy')
 check((await pool.query("SELECT has_table_privilege('authenticated','public.queja_adjuntos','INSERT') ok")).rows[0].ok,'Failed atomic cutover restores earlier attachment table ACL')
 await pool.query('CREATE POLICY "Staff puede subir adjuntos" ON public.queja_adjuntos FOR INSERT WITH CHECK(public.app_es_staff())')
 await pool.query(combinedCutover)
 await pool.query(fs.readFileSync('scripts/verificar-public-forms-cutover.sql','utf8'));checks++
 check((await as('authenticated','SELECT id FROM public.formularios_publicos',[],admin)).length===1,'Combined cutover preserves active admin metadata read')
 check((await as('authenticated','SELECT id FROM public.formularios_publicos',[],owner)).length===0,'Combined cutover closes non-admin metadata enumeration')
 await reject(()=>as('anon','SELECT id FROM public.formularios_publicos'),'42501','Combined cutover closes anon form metadata enumeration')
 for(const role of['anon','authenticated']){
  for(const operation of['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])check(!(await pool.query('SELECT has_table_privilege($1,$2,$3) ok',[role,'public.queja_adjuntos',operation])).rows[0].ok,'Closed direct '+role+' '+operation)
  await reject(()=>as(role,'SELECT public.registrar_adjunto_queja($1,$2,$3,$4,$5)',[caseId,'forged.pdf','arbitrary_drive_id',128,'application/pdf'],admin),'42501','Legacy private RPC closed')
  await reject(()=>as(role,"INSERT INTO public.queja_adjuntos(queja_id,nombre_archivo,storage_path)VALUES($1,'forged.pdf','arbitrary_drive_id')",[caseId],admin),'42501','Direct insert denied after cutover despite old staff policy')
  await reject(()=>as(role,"UPDATE public.queja_adjuntos SET storage_path='other_drive_id' WHERE id=$1",[inserted.id],admin),'42501','Direct path mutation denied')
 }
 check((await pool.query("SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename='queja_adjuntos' AND policyname='Staff puede subir adjuntos'")).rows[0].n===0,'Unused client attachment INSERT policy removed')
 for(const actor of[admin,quality,owner])check((await as('authenticated','SELECT id FROM public.queja_adjuntos WHERE id=$1',[inserted.id],actor)).length===1,'Authorized metadata SELECT preserved')
 check((await as('authenticated','SELECT id FROM public.queja_adjuntos WHERE id=$1',[inserted.id],other)).length===0,'Unassigned collaborator cannot read metadata')
 check((await as('authenticated','SELECT id FROM public.queja_adjuntos WHERE id=$1',[inserted.id],inactive)).length===0,'Inactive former admin cannot read metadata')
 await reject(()=>as('anon','SELECT id FROM public.queja_adjuntos'),'42501','Anon metadata SELECT absent')
 check((await as('service_role',rpc,args(quality,caseOther)))[0].value.usuario_id===quality,'Server registry still operates after cutover')
 await as('service_role','DELETE FROM public.queja_adjuntos WHERE id=$1',[inserted.id])
 check((await pool.query('SELECT count(*)::int n FROM public.queja_adjuntos WHERE id=$1',[inserted.id])).rows[0].n===0,'Authorized API service deletion retained')
 await verifyStorageAccess('After Drive metadata cutover')
 const result={passed:checks,local_only:true,production_writes:0,scope:'Server attachment roles, quota, concurrency, path mutation, ACL cutover and private legacy Storage access'}
 fs.writeFileSync(path.join(work,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-m','fast','-w','stop'])}
