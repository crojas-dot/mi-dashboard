// Fixture PostgreSQL aislada. No carga .env ni accede al proyecto remoto.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {randomBytes,randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const root=process.cwd(),bin=process.env.QMS_PG_BIN??'C:/Program Files/PostgreSQL/18/bin'
const work=path.join(root,'.performance','agenda-db-'+Date.now()),data=path.join(work,'data'),port=55462
const {Pool}=createRequire(path.join(root,'.performance/load-tools/package.json'))('pg')
const password=randomBytes(32).toString('hex');let pool,started=false,checks=0
const check=(a,b)=>{assert.deepEqual(a,b);checks++}
const run=(exe,args)=>{const result=spawnSync(path.join(bin,exe),args,{encoding:'utf8',windowsHide:true,timeout:60000});if(result.status!==0)throw new Error('PostgreSQL temporal no disponible: '+(result.error?.message??result.stderr??'').slice(-1400))}
const staff=randomUUID(),own=randomUUID(),other=randomUUID(),inactive=randomUUID(),denied=randomUUID()
async function agenda(user,zone='UTC',role='authenticated'){
  const c=await pool.connect()
  try{await c.query('SET ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('TimeZone',$2,false)",[user??'',zone]);return(await c.query('SELECT public.qms_get_agenda_hoy() AS items')).rows[0].items}
  finally{await c.query('RESET ROLE');c.release()}
}
try{
  fs.mkdirSync(work,{recursive:true});const pw=path.join(work,'pw');fs.writeFileSync(pw,password)
  run('initdb.exe',['-D',data,'-U','fixture','-A','scram-sha-256','--pwfile='+pw,'--encoding=UTF8','--locale=C']);fs.unlinkSync(pw)
  run('pg_ctl.exe',['-D',data,'-l',path.join(work,'postgres.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true
  pool=new Pool({host:'127.0.0.1',port,user:'fixture',password,database:'postgres',max:3})
  await pool.query(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;
    CREATE SCHEMA auth;CREATE SCHEMA qms_private;GRANT USAGE ON SCHEMA auth,qms_private,public TO authenticated;
    CREATE TABLE usuarios(id uuid PRIMARY KEY,rol text,activo boolean);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE FUNCTION public.app_usuario_actual_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT id FROM public.usuarios WHERE id=auth.uid() AND activo$$;
    CREATE FUNCTION public.app_es_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND activo AND rol='admin')$$;
    CREATE FUNCTION public.app_es_staff() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT public.app_es_admin()$$;
    CREATE FUNCTION public.app_es_colaborador() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND activo AND rol='colaborador')$$;
    CREATE FUNCTION public.app_tiene_permiso(text,boolean) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT public.app_es_admin() OR ($1='mis_quejas' AND public.app_es_colaborador())$$;
    CREATE TABLE public.quejas(id uuid PRIMARY KEY,folio text,descripcion text,estado text,responsable_id uuid,plazo_vence timestamptz,fecha timestamptz DEFAULT now()-interval '1 day');
    CREATE TABLE public.qms_calendars(id bigint PRIMARY KEY,weekdays int[],holidays jsonb);
    INSERT INTO public.qms_calendars VALUES(1,ARRAY[1,2,3,4,5],'[]');
    CREATE FUNCTION public.qms_business_day(p_day date,p_calendar bigint) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT extract(isodow from p_day)::int=ANY(weekdays) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(holidays) h WHERE (h->>'date')::date=p_day)
      FROM public.qms_calendars WHERE id=p_calendar$$;
    CREATE TABLE public.qms_stage_runs(id uuid,case_id uuid,calendar_id bigint,stage_id text,expires_at timestamptz,started_at timestamptz,ended_at timestamptz,end_event text);
    ALTER TABLE public.quejas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_cases ON public.quejas TO authenticated USING(public.app_es_admin() OR (public.app_es_colaborador() AND responsable_id=public.app_usuario_actual_id()));
    CREATE VIEW public.qms_quejas WITH(security_invoker=true) AS SELECT * FROM public.quejas;
    CREATE TABLE public.auditorias(id uuid PRIMARY KEY,folio text,objetivo text,estado text,fecha_inicio timestamptz,fecha_fin timestamptz);
    ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;
    CREATE POLICY staff_audits ON public.auditorias TO authenticated USING(public.app_es_admin());
    CREATE TABLE public.queja_mail_outbox(queja_id uuid,tipo text,usuario_id uuid,created_at timestamptz);
    CREATE TABLE public.queja_gc_revisiones(queja_id uuid,decision text,created_at timestamptz);
    ALTER TABLE public.queja_gc_revisiones ENABLE ROW LEVEL SECURITY;
    CREATE POLICY staff_review ON public.queja_gc_revisiones TO authenticated USING(public.app_es_admin());
    ALTER TABLE public.qms_stage_runs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY visible_runs ON public.qms_stage_runs TO authenticated USING(EXISTS(SELECT 1 FROM quejas q WHERE q.id=case_id));
    GRANT SELECT ON public.quejas,public.qms_quejas,public.auditorias,public.qms_stage_runs,public.qms_calendars,public.queja_gc_revisiones TO authenticated;`)
  for(const [id,rol,activo] of [[staff,'admin',true],[own,'colaborador',true],[other,'colaborador',true],[inactive,'admin',false],[denied,'sin_permiso',true]])await pool.query('INSERT INTO usuarios VALUES($1,$2,$3)',[id,rol,activo])
  const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_agenda_hoy.sql'))
  await pool.query(fs.readFileSync(path.join('supabase/migrations',migration),'utf8'))
  const extension=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_agenda_hoy_fecha_limite.sql'))
  await pool.query(fs.readFileSync(path.join('supabase/migrations',extension),'utf8'))
  const recibidas=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_agenda_hoy_recibidas_y_proximas.sql'))
  await pool.query(fs.readFileSync(path.join('supabase/migrations',recibidas),'utf8'))
  async function complaint(code,offset,owner=own,state='En Investigación'){
    const id=randomUUID();await pool.query("INSERT INTO quejas(id,folio,descripcion,estado,responsable_id,plazo_vence) VALUES($1,$2,'Detalle',$3,$4,CASE WHEN $5::int IS NULL THEN NULL ELSE (((now() AT TIME ZONE 'America/Costa_Rica')::date+$5+1)::timestamp AT TIME ZONE 'America/Costa_Rica')-interval '1 microsecond' END)",[id,code,state,owner,offset]);
    if(offset!==null)await pool.query("INSERT INTO qms_stage_runs SELECT $2,id,1,'quejas.investigation',plazo_vence,now()-interval '3 days',null,null FROM quejas WHERE id=$1",[id,randomUUID()]);return id
  }
  const workdays=(await pool.query("SELECT n AS offset FROM generate_series(1,15) n WHERE qms_business_day((now() AT TIME ZONE 'America/Costa_Rica')::date+n,1) ORDER BY n LIMIT 2")).rows.map(x=>x.offset)
  const due=await complaint('due',0),returned=await complaint('return',null),assigned=await complaint('assigned',null)
  await complaint('soon',workdays[1])
  await complaint('other',0,other);await complaint('finished',0,own,'Finalizado');await complaint('rejected',0,own,'No Procede');await complaint('tomorrow',workdays[0])
  await complaint('waiting_for_gc',0,own,'Pendiente de Revisión GC')
  const received=await complaint('received_today',5,null,'Recibido')
  const receivedDue=await complaint('received_due_today',0,null,'Recibido')
  const future=await complaint('future_received',5,null,'Recibido')
  await complaint('old_received',5,null,'Recibido')
  await complaint('expired',-1)
  await complaint('far',workdays[1]+7)
  await pool.query('UPDATE quejas SET fecha=now() WHERE id=ANY($1::uuid[])',[[received,receivedDue]])
  await pool.query("UPDATE quejas SET fecha=((now() AT TIME ZONE 'America/Costa_Rica')::date+1)::timestamp AT TIME ZONE 'America/Costa_Rica' WHERE id=$1",[future])
  for(const id of [due,returned,assigned])await pool.query("INSERT INTO queja_mail_outbox VALUES($1,'interno_asignacion',$2,now())",[id,own])
  for(const id of [due,returned])await pool.query("INSERT INTO queja_gc_revisiones VALUES($1,'returned',now())",[id])
  await pool.query("INSERT INTO auditorias VALUES($1,'audit','Objetivo','Planificada',now(),now()+interval '4 days')",[randomUUID()])
  const mine=await agenda(own)
  check(mine.map(x=>x.codigo),['due','return','assigned','tomorrow','soon'])
  check(mine.map(x=>x.motivo),['vence_hoy','devuelto_hoy','nueva_asignacion','vence_en_1_dia','vence_en_2_dias'])
  check(mine.every(x=>x.ruta==='/mis-quejas'),true)
  check(new Set(mine.map(x=>x.id)).size,mine.length)
  check(Object.keys(mine[0]).sort(),['codigo','descripcion','fecha_limite','id','motivo','ruta'])
  check(mine[1].fecha_limite,null)
  check(mine[0].fecha_limite,(await pool.query("SELECT to_char(now() AT TIME ZONE 'America/Costa_Rica','YYYY-MM-DD') AS dia")).rows[0].dia)
  for(const zone of ['Pacific/Kiritimati','America/Los_Angeles'])check(await agenda(own,zone),mine)
  const all=await agenda(staff);check(all.some(x=>x.motivo==='programada_hoy'),true);check(all.some(x=>x.codigo==='other'),true)
  check(all.find(x=>x.codigo==='received_today')?.motivo,'recibida_hoy')
  check(all.filter(x=>x.codigo==='received_due_today').map(x=>x.motivo),['vence_hoy'])
  check(all.some(x=>['old_received','future_received'].includes(x.codigo)),false)
  check(mine.some(x=>x.motivo==='recibida_hoy'),false)
  const receivedDate=all.find(x=>x.codigo==='received_today').fecha_limite
  check(receivedDate,(await pool.query("SELECT to_char((now() AT TIME ZONE 'America/Costa_Rica')::date+5,'YYYY-MM-DD') AS dia")).rows[0].dia)
  for(const zone of ['Pacific/Kiritimati','America/Los_Angeles'])check(await agenda(staff,zone),all)
  await pool.query("UPDATE quejas SET fecha=(now() AT TIME ZONE 'America/Costa_Rica')::date::timestamp AT TIME ZONE 'America/Costa_Rica' WHERE id=$1",[received])
  check((await agenda(staff)).find(x=>x.codigo==='received_today')?.motivo,'recibida_hoy')
  for(const who of [null,inactive,denied])check(await agenda(who),[])
  const others=await agenda(other);check(others.length,1);check(others[0].codigo,'other')
  const proposal=await complaint('proposal_today',workdays[1]+7,own,'Pendiente de Revisión GC')
  await pool.query("UPDATE qms_stage_runs SET ended_at=now(),end_event='Pendiente de Revisión GC' WHERE case_id=$1",[proposal])
  const approved=await complaint('ready_today',null,own,'Resuelto')
  await pool.query("INSERT INTO queja_gc_revisiones VALUES($1,'approved',now())",[approved])
  const news=await agenda(staff)
  check(news.find(x=>x.codigo==='proposal_today')?.motivo,'revision_hoy')
  check(news.find(x=>x.codigo==='ready_today')?.motivo,'lista_publicar_hoy')
  check((await agenda(own)).some(x=>['proposal_today','ready_today','received_today'].includes(x.codigo)),false)
  check(news.some(x=>['expired','far','finished','rejected'].includes(x.codigo)),false)
  // Cambiar el calendario vigente no cambia el que conservan los plazos históricos.
  await pool.query("INSERT INTO qms_calendars VALUES(2,ARRAY[]::int[],'[]')")
  check((await agenda(own)).map(x=>x.codigo),mine.map(x=>x.codigo))
  await pool.query("INSERT INTO qms_calendars VALUES(3,ARRAY[1,2,3,4,5],jsonb_build_array(jsonb_build_object('date',((now() AT TIME ZONE 'America/Costa_Rica')::date+$1::int)::text)))",[workdays[0]])
  const holidayDays=(await pool.query("SELECT n AS offset FROM generate_series(1,20) n WHERE qms_business_day((now() AT TIME ZONE 'America/Costa_Rica')::date+n,3) ORDER BY n LIMIT 3")).rows.map(x=>x.offset)
  const holidaySoon=await complaint('holiday_soon',holidayDays[1])
  const holidayFar=await complaint('holiday_far',holidayDays[2])
  await pool.query('UPDATE qms_stage_runs SET calendar_id=3 WHERE case_id=ANY($1::uuid[])',[[holidaySoon,holidayFar]])
  const calendarResult=await agenda(own)
  check(calendarResult.find(x=>x.codigo==='holiday_soon')?.motivo,'vence_en_2_dias')
  check(calendarResult.some(x=>x.codigo==='holiday_far'),false)
  const expiredToday=await complaint('expired_today',0)
  await pool.query("UPDATE quejas SET plazo_vence=now()-interval '1 second' WHERE id=$1",[expiredToday])
  check((await agenda(staff)).some(x=>x.codigo==='expired_today'),false)
  // Al día siguiente desaparecen novedades sin vencimiento cercano.
  await pool.query("UPDATE queja_mail_outbox SET created_at=now()-interval '1 day'; UPDATE queja_gc_revisiones SET created_at=now()-interval '1 day'; UPDATE qms_stage_runs SET ended_at=now()-interval '1 day' WHERE ended_at IS NOT NULL; UPDATE quejas SET fecha=now()-interval '1 day'")
  check((await agenda(staff)).some(x=>['received_today','proposal_today','ready_today','return','assigned'].includes(x.codigo)),false)
  await assert.rejects(()=>agenda(own,'UTC','anon'),e=>e.code==='42501');checks++
  for(let i=0;i<30;i++)await complaint('extra-'+i,0)
  check((await agenda(own)).length,20)
  check((await agenda(own)).every(x=>x.motivo==='vence_hoy'),true)
  const evidence={checks,remoteBusinessWrites:0,migration:recibidas,coverage:['novedades hoy según rol y desaparición al día siguiente','ventana de uno/dos días hábiles','fines de semana, feriado y versión histórica','sin vencidas ni finalizadas','RLS propias/staff','inactivos y anónimo','prioridad y deduplicación','máximo 20','zona CR y límites del día','UNION auditorías','contrato JSON exacto']}
  fs.writeFileSync(path.join(work,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence))
}finally{if(pool)await pool.end();if(started)run('pg_ctl.exe',['-D',data,'-m','immediate','-w','stop'])}
