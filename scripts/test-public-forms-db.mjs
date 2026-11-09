// Solo DB local nueva y datos sinteticos; sin .env, URLs remotas ni clusters anteriores.
// Herramientas: PostgreSQL binarios y pg preexistente en .performance/load-tools.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {randomBytes,randomUUID,createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=process.cwd(),bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin'
const work=path.join(root,'.performance','public-forms-db-'+Date.now()),data=path.join(work,'data'),port=55447
const {Pool}=createRequire(path.join(root,'.performance/load-tools/package.json'))('pg')
const password=randomBytes(32).toString('hex'),hash=s=>createHash('sha256').update(s).digest('hex')
let pool,started=false,checks=0
function run(binary,args){const r=spawnSync(path.join(bin,binary),args,{encoding:'utf8',stdio:'ignore',windowsHide:true,timeout:60000});if(r.status!==0)throw new Error(r.stderr||r.stdout||'Postgres command failed')}
function check(c,m){assert.ok(c,m);checks++}
async function reject(fn,code,m){await assert.rejects(fn,e=>e.code===code,m);checks++}
async function call(fn,args,role='service_role'){const c=await pool.connect();try{await c.query('SET ROLE '+role);return(await c.query('SELECT public.'+fn+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') AS value',args)).rows[0].value}finally{await c.query('RESET ROLE');c.release()}}
try{
 fs.mkdirSync(work,{recursive:true});const pw=path.join(work,'pw');fs.writeFileSync(pw,password)
 run('initdb.exe',['-D',data,'-U','qms_fixture','-A','scram-sha-256','--pwfile='+pw,'--encoding=UTF8','--locale=C']);fs.unlinkSync(pw)
 run('pg_ctl.exe',['-D',data,'-l',path.join(work,'postgres.log'),'-o','-h 127.0.0.1 -p '+port+' -c max_connections=80','-w','start']);started=true
 pool=new Pool({host:'127.0.0.1',port,user:'qms_fixture',password,database:'postgres',max:40,statement_timeout:15000})
 await pool.query(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
 CREATE TABLE public.usuarios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nombre text,email text,rol text,estado text);
 INSERT INTO public.usuarios(nombre,email,rol,estado) VALUES ('Staff fixture','staff@example.invalid','admin','activo'),('Quality fixture','quality@example.invalid','calidad','activo');
 CREATE TABLE public.formularios_publicos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),modulo text NOT NULL DEFAULT 'quejas',nombre text NOT NULL,token text UNIQUE NOT NULL,activo boolean NOT NULL DEFAULT true);
 CREATE TABLE public.folios_quejas_anuales(anio integer PRIMARY KEY,ultimo integer NOT NULL);
 CREATE TABLE public.quejas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),folio text NOT NULL UNIQUE,cliente_nombre text NOT NULL,email_cliente text,telefono text,categoria text,descripcion text,estado text,fecha timestamptz);
 CREATE TABLE public.queja_adjuntos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),queja_id uuid NOT NULL REFERENCES public.quejas(id) ON DELETE CASCADE,nombre_archivo text NOT NULL,nombre text NOT NULL,storage_path text NOT NULL,url_archivo text,tamano integer,tipo_mime text,usuario_id uuid,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.notificaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario_id uuid,fecha timestamptz,tipo text,mensaje text,enlace text,origen_id text);
 CREATE TABLE public.mail_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),destinatario text,asunto text,cuerpo text,estado text,intentos integer,created_at timestamptz);
 ALTER TABLE public.formularios_publicos ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION public.app_es_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('qms.fixture_admin',true)='true'$$;
 CREATE POLICY formularios_publicos_active_select ON public.formularios_publicos FOR SELECT TO anon,authenticated USING (activo);
 CREATE POLICY formularios_publicos_admin_write ON public.formularios_publicos FOR ALL TO authenticated USING (public.app_es_admin()) WITH CHECK (public.app_es_admin());
 -- Firmas/policy privadas mínimas: el archivo aplicado corta gateway y Drive en un único DO.
 CREATE FUNCTION public.registrar_adjunto_queja(uuid,text,text,bigint,text) RETURNS text LANGUAGE sql AS $$SELECT 'fixture'$$;
 CREATE POLICY "Staff puede subir adjuntos" ON public.queja_adjuntos FOR INSERT TO authenticated WITH CHECK (public.app_es_admin());
 CREATE FUNCTION public.crear_queja_publica_con_atributos(text,text,text,text,text,text) RETURNS text LANGUAGE sql AS $$SELECT 'fixture'$$;
 CREATE FUNCTION public.crear_queja_publica_con_atributos(text,text,text,text,text,text,text) RETURNS text LANGUAGE sql AS $$SELECT 'fixture'$$;
 `)
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,'supabase/backups/public_forms_gateway_preflight_20261008.json'),'utf8'))
 for(const e of snapshot.functions)await pool.query(e.definition)
 await pool.query(fs.readFileSync(path.join(root,'supabase/migrations/20261008224037_public_forms_gateway.sql'),'utf8'))
 await pool.query(fs.readFileSync(path.join(root,'supabase/migrations/20261009031934_public_forms_drive_path.sql'),'utf8'))
 const form=randomUUID(),token='fixture_'+randomUUID(),sub=randomUUID(),key=hash('fixture-ip')
 await pool.query('INSERT INTO public.formularios_publicos(id,nombre,token) VALUES ($1,$2,$3)',[form,'Fixture form',token])
 const args=[form,token,sub,hash('canonical fixture'),key,'Citizen fixture',null,null,'Queja','Synthetic complaint']
 const duplicates=await Promise.all(Array.from({length:25},()=>call('public_form_create_submission',args)))
 check(new Set(duplicates.map(x=>x.queja_id)).size===1,'25 parallel claims produce one case')
 check(new Set(duplicates.map(x=>x.folio)).size===1,'25 parallel claims share official folio')
 check(duplicates.filter(x=>x.created).length===1,'Exactly one creator')
 check(new Set(duplicates.map(x=>x.created_at)).size===1,'Stable creation time')
 check(duplicates[0].folio.match(/^\d{4}-\d{3,}$/),'Official folio format')
 const q=duplicates[0].queja_id
 check((await pool.query('SELECT attempts FROM public.public_form_rate_limits WHERE key_hash=$1',[key])).rows[0].attempts===1,'Retries consume no accepted quota')
 for(const [index,value,code]of[[3,hash('other'),'23505'],[1,'wrong-token','42501'],[5,'x'.repeat(151),'22023'],[7,'x'.repeat(41),'22023'],[8,'admin','22023']])await reject(()=>call('public_form_create_submission',args.map((x,i)=>i===index?value:x)),code,'Input or payload conflict')
 const rates=await Promise.all(Array.from({length:30},()=>call('public_form_consume_rate',[hash('attempt-counter'),'attempt',10,900])))
 check(rates.filter(x=>x.allowed).length===10,'Atomic rate: 10 of 30')
 check(rates.filter(x=>!x.allowed).every(x=>x.retry_after>0&&x.retry_after<=900),'Rate retry duration')
 await reject(()=>call('public_form_consume_rate',['plain-ip','attempt',10,900]),'22023','Raw IP rejected')
 await pool.query("UPDATE public.public_form_rate_limits SET reset_at=now()-interval '1 second' WHERE key_hash=$1",[hash('attempt-counter')])
 check((await call('public_form_consume_rate',[hash('attempt-counter'),'attempt',10,900])).allowed,'Rate resets at expiry')
 const accepted=await Promise.allSettled(Array.from({length:25},()=>call('public_form_create_submission',[...args.slice(0,2),randomUUID(),hash('new'),hash('accepted-key'),...args.slice(5)])))
 check(accepted.filter(x=>x.status==='fulfilled').length===20,'Accepted quota: 20 of 25')
 check(accepted.filter(x=>x.status==='rejected').every(x=>x.reason.code==='P0001'&&x.reason.message==='PUBLIC_RATE_LIMITED'),'Create rate error mapped')
 check((await pool.query('SELECT count(*)::int AS n FROM public.public_form_submissions')).rows[0].n===21,'Denied claims rollback')
 check((await pool.query('SELECT ultimo FROM public.folios_quejas_anuales')).rows[0].ultimo===21,'Denied claims consume no folio')
 const ids=Array.from({length:15},()=>randomUUID())
 const uploadArgs=i=>[form,sub,q,ids[i],hash('bytes'+i),'fixture'+i+'.pdf','application/pdf',4194304]
 const reserves=await Promise.allSettled(ids.map((u,i)=>call('public_form_reserve_upload',uploadArgs(i))))
 check(reserves.filter(x=>x.status==='fulfilled').length===10,'Reserve quota: 10 of 15')
 check(reserves.filter(x=>x.status==='rejected').every(x=>x.reason.code==='54000'),'Reserve quota rejection')
 check((await pool.query('SELECT sum(tamano)::bigint AS n FROM public.public_form_uploads')).rows[0].n==='41943040','Reserved bytes <=40MiB')
 const idx=reserves.findIndex(x=>x.status==='fulfilled'),u=ids[idx],r=reserves[idx].value
 const replay=await call('public_form_reserve_upload',uploadArgs(idx))
 check(!replay.created&&replay.reservation_id===r.reservation_id,'Replay cannot trigger a second upload')
 await reject(()=>call('public_form_reserve_upload',uploadArgs(idx).map((x,i)=>i===4?hash('changed'):x)),'23505','Changed content conflicts')
 await reject(()=>call('public_form_reserve_upload',[form,sub,randomUUID(),randomUUID(),hash('x'),'x.pdf','application/pdf',10]),'42501','Cross-case upload denied')
 await reject(()=>call('public_form_reserve_upload',[form,sub,q,randomUUID(),hash('x'),'x.pdf','application/pdf',4194305]),'22023','File size bound')
 await reject(()=>call('public_form_reserve_upload',[form,sub,q,randomUUID(),hash('x'),'x.exe','application/octet-stream',10]),'22023','Public MIME bound')
 await reject(()=>call('public_form_finalize_submission',[form,sub,q]),'23505','Finalize rejects pending upload')
 const commitArgs=[form,sub,q,u,r.reservation_id,'drive:fixture_file']
 const staffAttachment=randomUUID()
 await pool.query('INSERT INTO public.queja_adjuntos(id,queja_id,nombre_archivo,nombre,storage_path,tamano,tipo_mime) VALUES ($1,$2,$3,$3,$4,$5,$6)',[staffAttachment,q,'staff-fixture.pdf','drive:staff_fixture',100,'application/pdf'])
 await reject(()=>call('public_form_commit_upload',commitArgs),'54000','Quota rechecked after external upload')
 await pool.query('DELETE FROM public.queja_adjuntos WHERE id=$1',[staffAttachment])
 const committed=await call('public_form_commit_upload',commitArgs)
 check(committed.committed&&committed.adjunto_id,'Legacy registry mapping works')
 const legacyPath=(await pool.query('SELECT storage_path,url_archivo FROM public.queja_adjuntos WHERE id=$1',[committed.adjunto_id])).rows[0]
 check(legacyPath.storage_path==='fixture_file'&&legacyPath.url_archivo==='fixture_file','Panel receives raw Drive ID while reservations retain typed URI')
 const commits=await Promise.all(Array.from({length:10},()=>call('public_form_commit_upload',commitArgs)))
 check(commits.every(x=>x.adjunto_id===committed.adjunto_id),'Concurrent commit retry same attachment')
 check((await pool.query('SELECT count(*)::int AS n FROM public.queja_adjuntos WHERE queja_id=$1',[q])).rows[0].n===1,'One metadata row')
 await reject(()=>call('public_form_commit_upload',commitArgs.map((x,i)=>i===5?'drive:changed':x)),'23505','Committed path cannot change')
 await reject(()=>call('public_form_release_upload',commitArgs.slice(0,5)),'23505','Committed reservation cannot release')
 for(let i=0;i<reserves.length;i++)if(i!==idx&&reserves[i].status==='fulfilled')await call('public_form_release_upload',[form,sub,q,ids[i],reserves[i].value.reservation_id])
 const i2=reserves.findIndex((x,i)=>i!==idx&&x.status==='fulfilled'),old=reserves[i2].value
 const renewed=await call('public_form_reserve_upload',uploadArgs(i2))
 check(renewed.created&&renewed.reservation_id!==old.reservation_id,'Compensated retry owns new reservation')
 await reject(()=>call('public_form_commit_upload',[form,sub,q,ids[i2],old.reservation_id,'drive:stale']),'23505','Stale writer rejected')
 await reject(()=>call('public_form_release_upload',[form,sub,q,ids[i2],old.reservation_id]),'23505','Stale compensation rejected')
 await call('public_form_release_upload',[form,sub,q,ids[i2],renewed.reservation_id])
 const finalized=await Promise.all(Array.from({length:20},()=>call('public_form_finalize_submission',[form,sub,q])))
 check(finalized.every(x=>x.finalized),'Finalize 20 retries succeeds')
 check((await pool.query('SELECT count(*)::int AS n FROM public.notificaciones WHERE origen_id=$1',[q])).rows[0].n===2,'Once per synthetic staff notification')
 check((await pool.query('SELECT count(*)::int AS n FROM public.mail_queue')).rows[0].n===2,'Once per synthetic staff mail')
 const afterId=randomUUID(),after=await call('public_form_reserve_upload',[form,sub,q,afterId,hash('later'),'later.png','image/png',100])
 check(after.created,'File retry allowed after finalize')
 await pool.query('UPDATE public.formularios_publicos SET activo=false WHERE id=$1',[form])
 await reject(()=>call('public_form_commit_upload',[form,sub,q,afterId,after.reservation_id,'drive:disabled']),'42501','Disable during upload prevents commit')
 check(await call('public_form_release_upload',[form,sub,q,afterId,after.reservation_id]),'Compensation after disable allowed')
 await pool.query('UPDATE public.formularios_publicos SET activo=true WHERE id=$1',[form])
 await pool.query('UPDATE public.quejas SET estado=$1 WHERE id=$2',['En Investigación',q])
 await reject(()=>call('public_form_reserve_upload',[form,sub,q,randomUUID(),hash('closed'),'closed.pdf','application/pdf',10]),'23505','Transition closes public attachments')
 for(const role of['anon','authenticated']){
  await reject(()=>call('public_form_create_submission',args,role),'42501',role+' cannot invoke create')
  await reject(()=>call('public_form_consume_rate',[hash('x'),'attempt',10,900],role),'42501',role+' cannot invoke rate')
  const c=await pool.connect();try{await c.query('SET ROLE '+role);await reject(()=>c.query('SELECT * FROM public.public_form_submissions'),'42501',role+' cannot read submissions')}finally{await c.query('RESET ROLE');c.release()}
 }
 check((await pool.query("SELECT count(*)::int AS n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'public_form_%' AND (prosecdef OR NOT ('search_path=\"\"'=ANY(proconfig)))")).rows[0].n===0,'All RPC invoker with empty search_path')
 check((await pool.query("SELECT count(*)::int AS n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'public_form_%' AND (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE'))")).rows[0].n===0,'Every gateway function excludes client roles')
 check((await pool.query("SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('public_form_submissions','public_form_uploads','public_form_rate_limits') AND relrowsecurity")).rows[0].n===3,'All gateway tables RLS enabled')
 check((await pool.query("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public' AND tablename IN ('public_form_submissions','public_form_uploads','public_form_rate_limits')")).rows[0].n===0,'No client policy on gateway tables')
 await pool.query(fs.readFileSync(path.join(root,'scripts/verificar-public-forms-gateway.sql'),'utf8'));checks++
 await pool.query(fs.readFileSync(path.join(root,'supabase/migrations/20261009231000_public_forms_drive_access_cutover.sql'),'utf8'))
 const legacy=['crear_queja_publica(text,text,text,text,text,text)','crear_queja_publica_con_atributos(text,text,text,text,text,text)','crear_queja_publica_con_atributos(text,text,text,text,text,text,text)','registrar_adjunto_queja_publica(uuid,text,text,bigint,text)','notificar_queja_publica(text)']
 for(const role of['anon','authenticated'])for(const sig of legacy)check(!(await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS yes",[role,'public.'+sig])).rows[0].yes,'Cutover closes '+role+' '+sig)
 const c=await pool.connect();try{await c.query('SET ROLE authenticated');await c.query("SET qms.fixture_admin='true'");check((await c.query('SELECT count(*)::int AS n FROM public.formularios_publicos')).rows[0].n===1,'Admin metadata preserved')}finally{await c.query('RESET ROLE');c.release()}
 await pool.query(fs.readFileSync(path.join(root,'scripts/verificar-public-forms-cutover.sql'),'utf8'));checks++
 await pool.query(fs.readFileSync(path.join(root,'scripts/rollback-public-forms-cutover.sql'),'utf8'))
 for(const sig of legacy)check((await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS yes",['anon','public.'+sig])).rows[0].yes,'Rollback restores '+sig)
 const result={passed:checks,project:'isolated synthetic PostgreSQL',production_writes:0,parallel:{submissions:25,rate:30,accepted:25,reserves:15,commits:10,finalize:20}}
 fs.writeFileSync(path.join(work,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-m','fast','-w','stop'])}
